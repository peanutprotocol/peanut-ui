/**
 * DynamicBankAccountForm — the existing-account branch (Chip round 9).
 *
 * With `onExistingAccount` (withdraw flow) a typed account that matches a
 * saved one short-circuits: the handler receives the saved account and no
 * add/`onSuccess` runs. WITHOUT the handler (claim flow) submission proceeds
 * to `onSuccess` — the old unconditional short-circuit hijacked claim users
 * into the withdraw flow, which dead-ended on its no-amount guard; the
 * backend add is idempotent for the same user's account, so falling through
 * is safe.
 */
import React from 'react'
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react'

// ---------- module-level mocks ----------

jest.mock('next/navigation', () => ({
    useParams: () => ({}),
    useSearchParams: () => ({ get: () => null }),
}))

jest.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

// Where the user lives, as /users/me reports it. Nobody by default.
let mockResidence: { declared: string | null; declaredSecond: string | null; verified: string | null } | undefined
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { fullName: 'John Doe', email: 'john@doe.co' }, residence: mockResidence } }),
}))

jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isFromSendFlow: false }),
}))

const SAVED_US_ACCOUNT = {
    id: 'acct-1',
    identifier: '123456789',
    type: 'us',
    details: { countryCode: 'USA' },
}
jest.mock('@/hooks/useSavedAccounts', () => ({
    __esModule: true,
    default: () => [SAVED_US_ACCOUNT],
}))

// `getBicFromIban` runs for real: it reads a table bundled with the app, so the
// the provider check is a network call
const mockValidateBankAccount = jest.fn(async (_account: string) => true)
jest.mock('@/utils/bridge-accounts.utils', () => ({
    ...jest.requireActual('@/utils/bridge-accounts.utils'),
    validateBankAccount: (account: string) => mockValidateBankAccount(account),
}))

const mockScrollClear = jest.fn()
jest.mock('@/utils/bottom-nav-clearance.utils', () => ({
    scrollClearOfBottomNav: (element: unknown) => mockScrollClear(element),
}))

const mockReadClipboard = jest.fn()
jest.mock('@/utils/clipboard-extract.utils', () => ({
    ...jest.requireActual('@/utils/clipboard-extract.utils'),
    readClipboard: () => mockReadClipboard(),
}))

jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ info: jest.fn(), error: jest.fn(), success: jest.fn(), warning: jest.fn() }),
}))

// What the app knows about the person's own payout details. Nothing by
// default, so every test above this line sees the form as it was before
// prefill existed — which is also the behaviour a user with no known details
// gets in production.
type MockOwnIdentity = {
    ownerName: string | null
    address: {
        street: string
        city: string
        state: string
        postalCode: string
        countryCode: string | null
    } | null
    isLoading: boolean
}
const NOTHING_KNOWN: MockOwnIdentity = { ownerName: null, address: null, isLoading: false }
let mockOwnIdentity: MockOwnIdentity = NOTHING_KNOWN
jest.mock('@/hooks/useOwnAccountIdentity', () => ({
    useOwnAccountIdentity: () => mockOwnIdentity,
}))

// The two capture surfaces anything under this form could reach. Held by value
// so a test can assert the address never reached either.
const mockPosthogCapture = jest.fn()
const mockSentryCapture = jest.fn()
const mockSentryBreadcrumb = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockPosthogCapture(...args), identify: jest.fn() },
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockSentryCapture(...args),
    captureMessage: (...args: unknown[]) => mockSentryCapture(...args),
    addBreadcrumb: (...args: unknown[]) => mockSentryBreadcrumb(...args),
    setUser: jest.fn(),
    withScope: (fn: (scope: unknown) => void) =>
        fn({ setTag: jest.fn(), setContext: jest.fn(), setLevel: jest.fn(), setExtra: jest.fn() }),
}))

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/0_Bruddle/BaseSelect', () => ({
    __esModule: true,
    default: () => null,
}))

import { DynamicBankAccountForm } from '../DynamicBankAccountForm'

// ---------- helpers ----------

// complete, valid US bank details — matches SAVED_US_ACCOUNT's identifier
const US_INITIAL_DATA = {
    accountOwnerName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@doe.co',
    accountNumber: '123456789',
    routingNumber: '021000021', // valid ABA checksum
    street: '1 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    addressCountry: 'US',
}

const renderForm = (props: {
    onSuccess: jest.Mock
    onExistingAccount?: (account: unknown) => void
    flow: 'claim' | 'withdraw'
}) => {
    const ref = React.createRef<{ handleSubmit: () => void }>()
    render(
        <DynamicBankAccountForm
            ref={ref}
            country="USA"
            flow={props.flow}
            initialData={US_INITIAL_DATA}
            error={null}
            onSuccess={props.onSuccess}
            onExistingAccount={props.onExistingAccount}
        />
    )
    return ref
}

beforeEach(() => {
    jest.clearAllMocks()
    mockValidateBankAccount.mockResolvedValue(true)
    mockOwnIdentity = NOTHING_KNOWN
    mockResidence = undefined
})

// ---------- tests ----------

describe('DynamicBankAccountForm — existing-account branch (Chip round 9)', () => {
    it('withdraw flow: a typed account that already exists goes to onExistingAccount, never onSuccess', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const onExistingAccount = jest.fn()
        const ref = renderForm({ flow: 'withdraw', onSuccess, onExistingAccount })

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onExistingAccount).toHaveBeenCalledWith(expect.objectContaining({ identifier: '123456789' }))
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('claim flow (no handler): an already-saved account proceeds to onSuccess instead of navigating', async () => {
        // the backend add is idempotent for the same user's account — the old
        // unconditional short-circuit pushed claim users into the withdraw
        // flow's no-amount dead end
        const onSuccess = jest.fn(async () => ({}))
        const ref = renderForm({ flow: 'claim', onSuccess })

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(onSuccess).toHaveBeenCalledWith(
            expect.objectContaining({ accountNumber: '123456789' }),
            expect.objectContaining({ accountNumber: '123456789' })
        )
    })
})

const CO_INITIAL_DATA = {
    accountOwnerName: 'Ana Gomez',
    accountNumber: '12345678910',
    documentType: 'cc',
    documentNumber: '1234567890',
    bankCode: '1007',
    accountCategory: 'savings',
    phoneNumber: '+573001234567',
}

describe('DynamicBankAccountForm — the Colombian corridor', () => {
    it('sends the document, bank code, account type and phone, and no address', async () => {
        const onSuccess = jest.fn(async (_payload: unknown, _rawData: unknown) => ({}))
        const ref = React.createRef<{ handleSubmit: () => void }>()
        render(
            <DynamicBankAccountForm
                ref={ref}
                country="CO"
                flow="withdraw"
                initialData={CO_INITIAL_DATA}
                error={null}
                onSuccess={onSuccess}
            />
        )

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onSuccess).toHaveBeenCalledTimes(1)
        const payload = onSuccess.mock.calls[0][0] as unknown as Record<string, unknown>
        expect(payload).toMatchObject({
            accountType: 'co_bank_transfer',
            accountNumber: '12345678910',
            countryCode: 'CO',
            documentType: 'cc',
            documentNumber: '1234567890',
            bankCode: '1007',
            accountCategory: 'savings',
            phoneNumber: '+573001234567',
        })
        expect(payload.address).toBeUndefined()
    })

    it('refuses a phone number from another country', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const ref = React.createRef<{ handleSubmit: () => void }>()
        render(
            <DynamicBankAccountForm
                ref={ref}
                country="CO"
                flow="withdraw"
                initialData={{ ...CO_INITIAL_DATA, phoneNumber: '+5215512345678' }}
                error={null}
                onSuccess={onSuccess}
            />
        )

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onSuccess).not.toHaveBeenCalled()
    })
})

const GB_INITIAL_DATA = {
    accountOwnerName: 'Jane Smith',
    accountNumber: '12345678', // 8 digits
    sortCode: '123456',
    street: '10 Downing St',
    city: 'London',
    postalCode: 'SW1A 2AA',
}

describe('DynamicBankAccountForm — the UK corridor sends a beneficiary address', () => {
    it('includes the address (no state) in the payload so the provider body is complete', async () => {
        const onSuccess = jest.fn(async (_payload: unknown, _rawData: unknown) => ({}))
        const ref = React.createRef<{ handleSubmit: () => void }>()
        render(
            <DynamicBankAccountForm
                ref={ref}
                country="GBR"
                flow="withdraw"
                initialData={GB_INITIAL_DATA}
                error={null}
                onSuccess={onSuccess}
            />
        )

        await act(async () => {
            ref.current!.handleSubmit()
        })

        expect(onSuccess).toHaveBeenCalledTimes(1)
        const payload = onSuccess.mock.calls[0][0] as unknown as Record<string, unknown>
        expect(payload).toMatchObject({
            accountType: 'gb',
            address: {
                street: '10 Downing St',
                city: 'London',
                postalCode: 'SW1A 2AA',
                country: 'GBR',
            },
        })
    })
})

// ---------- the IBAN corridor: the BIC follows the IBAN ----------

// Real, checksum-valid IBANs. The bundled table knows the two German banks and
// has no data for Italy (nor PT/IE/LT…), which is the gap the required field covers.
const DE_IBAN = 'DE89370400440532013000'
const IT_IBAN = 'IT60X0542811101000000123456'

const IBAN_INITIAL_DATA = {
    accountOwnerName: 'Anna Rossi',
    street: '1 Via Roma',
    city: 'Rome',
    postalCode: '00100',
}

const renderIbanForm = (onSuccess: jest.Mock, country = 'DEU') => {
    const ref = React.createRef<{ handleSubmit: () => void }>()
    const view = render(
        <DynamicBankAccountForm
            ref={ref}
            country={country}
            flow="withdraw"
            initialData={IBAN_INITIAL_DATA}
            error={null}
            onSuccess={onSuccess}
        />
    )
    return { ref, ...view }
}

const ibanInput = () => document.getElementById('bank-accountNumber') as HTMLInputElement
const bicInput = () => document.getElementById('bank-bic') as HTMLInputElement | null

const typeIban = async (value: string, { blur }: { blur: boolean }) => {
    await act(async () => {
        fireEvent.change(ibanInput(), { target: { value } })
    })
    if (blur) {
        await act(async () => {
            fireEvent.blur(ibanInput())
        })
    }
}

const submitWithEnter = async (container: HTMLElement) => {
    await act(async () => {
        fireEvent.submit(container.querySelector('form')!)
    })
}

const payloadOf = (onSuccess: jest.Mock) => onSuccess.mock.calls[0][0] as Record<string, unknown>

describe('DynamicBankAccountForm — a SEPA IBAN is asked for on its own', () => {
    /*
     * The form used to ask for a BIC with every IBAN, and derived one where it
     * could. It asks for neither now: Regulation (EU) 260/2012 removed the BIC
     * from SEPA euro transfers in 2014 domestically and 2016 cross-border, and
     * the provider accepts an IBAN account without one. A field nobody needs is
     * a field that can be wrong, and a derived BIC was wrong silently.
     */
    it('shows no BIC field for an IBAN, and sends none', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)
        expect(bicInput()).not.toBeInTheDocument()

        await typeIban(DE_IBAN, { blur: true })
        expect(bicInput()).not.toBeInTheDocument()

        await submitWithEnter(container)
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        const payload = payloadOf(onSuccess)
        expect(payload).toMatchObject({ accountType: 'iban', accountNumber: DE_IBAN, countryCode: 'DEU' })
        expect(payload).not.toHaveProperty('bic')
    })

    it('an IBAN no table could ever have known submits just as well', async () => {
        // The Italian bank behind this IBAN was in none of the tables the form
        // used to carry, so this case could not be submitted without the user
        // finding a BIC by hand. Now it needs nothing.
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess, 'ITA')

        await typeIban(IT_IBAN, { blur: true })
        expect(bicInput()).not.toBeInTheDocument()

        await submitWithEnter(container)
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).not.toHaveProperty('bic')
    })

    it('shows the API error and stops, if the API still demands a BIC', async () => {
        // The API drops its "Valid BIC is required for IBAN accounts" rejection
        // in the change that pairs with this one, and the UI must deploy after
        // it. Should the two ever be the wrong way round, the submit has to end
        // in a readable error rather than a crash or a retry loop.
        const onSuccess = jest.fn(async () => ({ error: 'Valid BIC is required for IBAN accounts' }))
        const { container } = renderIbanForm(onSuccess)

        await typeIban(DE_IBAN, { blur: true })
        await submitWithEnter(container)

        expect(await screen.findByText('Valid BIC is required for IBAN accounts')).toBeInTheDocument()
        expect(onSuccess).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(screen.getByRole('button', { name: /continue|review/i })).toBeEnabled())
    })

    it('brings the submit button clear of the nav once the form can be submitted', async () => {
        const onSuccess = jest.fn(async () => ({}))
        renderIbanForm(onSuccess)
        expect(mockScrollClear).not.toHaveBeenCalled()

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(screen.getByRole('button', { name: /continue|review/i })).toBeEnabled())

        // the error sits above the button, so the button ends the form
        const cta = screen.getByTestId('bank-form-cta')
        expect(mockScrollClear).toHaveBeenCalledWith(cta)
        expect(cta.lastElementChild?.tagName).toBe('BUTTON')
    })
})

describe('DynamicBankAccountForm — tap-to-paste', () => {
    const pasteButtonFor = (input: HTMLElement) =>
        input.closest('.relative')!.parentElement!.querySelector('button[aria-label="withdraw.bankForm.pasteAria"]')!

    it('pasting an IBAN validates it and enables Continue with no manual blur', async () => {
        mockReadClipboard.mockResolvedValue({ ok: true, text: `IBAN: ${DE_IBAN}` })
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)
        const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement
        expect(submit).toBeDisabled()

        await act(async () => {
            fireEvent.click(pasteButtonFor(ibanInput()))
        })

        await waitFor(() => expect(ibanInput().value).toBe(DE_IBAN))
        expect(mockValidateBankAccount).toHaveBeenCalledWith(DE_IBAN)
        await waitFor(() => expect(submit).toBeEnabled())

        await act(async () => {
            fireEvent.click(submit)
        })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({ accountNumber: DE_IBAN })
    })

    it('pasting an invalid IBAN shows the error at once', async () => {
        mockReadClipboard.mockResolvedValue({ ok: true, text: 'DE00000000000000000000' })
        renderIbanForm(jest.fn(async () => ({})))

        await act(async () => {
            fireEvent.click(pasteButtonFor(ibanInput()))
        })

        expect(await screen.findByText('withdraw.bankForm.ibanInvalid')).toBeInTheDocument()
    })
})

/**
 * The euro area entered with NO country (QA round 2, Q2).
 *
 * The withdraw flow stopped asking which euro country the bank is in — a
 * Revolut or Wise customer does not know. The form is reached with the SEPA
 * destination instead of a country, and the IBAN answers the question.
 *
 * That makes the form the ONLY place an IBAN we cannot pay is refused, which
 * is the one way this change could make things worse. These pin it.
 */
describe('DynamicBankAccountForm — the euro area, entered with no country', () => {
    it('refuses an IBAN the provider does not support, naming what to do instead', async () => {
        mockValidateBankAccount.mockResolvedValue(false)
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess, 'SEPA')

        await typeIban(DE_IBAN, { blur: true })
        await submitWithEnter(container)

        expect(await screen.findByText('withdraw.bankForm.ibanUnsupported')).toBeInTheDocument()
        // nothing reaches the provider: the refusal happens here, not later
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('a supported IBAN submits with the country read off the IBAN, not off a country step', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess, 'SEPA')

        await typeIban(DE_IBAN, { blur: true })
        await submitWithEnter(container)

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toEqual(
            expect.objectContaining({
                accountType: 'iban',
                accountNumber: DE_IBAN,
                countryCode: 'DEU',
            })
        )
    })
})

// ---------- paying out to your own account ----------

/**
 * Nearly every payout goes to the person's own account, so the form fills in
 * the name and address the app already holds and says it did. The values are
 * in the fields, editable, and a hand edit outranks them.
 */

const KNOWN_IDENTITY: MockOwnIdentity = {
    ownerName: 'Anna Rossi',
    address: { street: '1 Via Roma', city: 'Rome', state: 'NY', postalCode: '00100', countryCode: null },
    isLoading: false,
}

const renderBareForm = (onSuccess: jest.Mock, country: string) => {
    const ref = React.createRef<{ handleSubmit: () => void }>()
    const view = render(
        <DynamicBankAccountForm ref={ref} country={country} flow="withdraw" error={null} onSuccess={onSuccess} />
    )
    return { ref, ...view }
}

const input = (name: string) => document.getElementById(`bank-${name}`) as HTMLInputElement | null
const ownAccountBox = () => screen.queryByRole('checkbox')

describe('DynamicBankAccountForm — my own account', () => {
    it('euro payout: the box is ticked, and the name and address are in the fields for the user to read', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')

        expect(ownAccountBox()).toBeChecked()
        expect(screen.getByText('withdraw.bankForm.ownAccountFilled')).toBeInTheDocument()
        await waitFor(() => expect(input('accountOwnerName')!.value).toBe('Anna Rossi'))
        expect(input('street')!.value).toBe('1 Via Roma')
        expect(input('city')!.value).toBe('Rome')
        expect(input('postalCode')!.value).toBe('00100')
    })

    it('euro payout: what was filled in reaches the provider payload', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderBareForm(onSuccess, 'SEPA')

        await typeIban(DE_IBAN, { blur: true })
        await submitWithEnter(container)

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({
            accountOwnerName: { firstName: 'Anna', lastName: 'Rossi' },
            address: { street: '1 Via Roma', city: 'Rome', postalCode: '00100' },
        })
    })

    it('unticking the box empties the fields the form filled in', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))

        await act(async () => {
            fireEvent.click(ownAccountBox()!)
        })

        expect(ownAccountBox()).not.toBeChecked()
        expect(screen.queryByText('withdraw.bankForm.ownAccountFilled')).not.toBeInTheDocument()
        expect(input('accountOwnerName')!.value).toBe('')
        expect(input('street')!.value).toBe('')
        expect(input('city')!.value).toBe('')
        expect(input('postalCode')!.value).toBe('')
    })

    /**
     * The BIC shipped with exactly this bug: a later pass put our answer back
     * over the user's correction. What the person typed is the answer.
     */
    it('a hand edit survives a later prefill pass', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))

        await act(async () => {
            fireEvent.change(input('city')!, { target: { value: 'Milan' } })
        })
        // the box is unticked and ticked again — two more prefill passes
        await act(async () => {
            fireEvent.click(ownAccountBox()!)
        })
        await act(async () => {
            fireEvent.click(ownAccountBox()!)
        })

        expect(input('city')!.value).toBe('Milan')
        // the fields the user did not touch are filled in again
        expect(input('street')!.value).toBe('1 Via Roma')
    })

    it('a user we know nothing about sees the form exactly as before: no box, empty fields', () => {
        mockOwnIdentity = NOTHING_KNOWN
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')

        expect(ownAccountBox()).not.toBeInTheDocument()
        expect(input('accountOwnerName')!.value).toBe('')
        expect(input('city')!.value).toBe('')
    })

    it('Colombia asks for no address, so only the name is filled in', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'CO')

        await waitFor(() => expect(input('accountOwnerName')!.value).toBe('Anna Rossi'))
        expect(input('street')).toBeNull()
        expect(input('city')).toBeNull()
        expect(input('postalCode')).toBeNull()
    })

    it('the United States keeps a state code of its own and drops one that is not', async () => {
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: { ...KNOWN_IDENTITY.address!, countryCode: 'US' } }
        const onSuccess = jest.fn(async () => ({}))
        const { container, ref } = renderBareForm(onSuccess, 'USA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))

        await act(async () => {
            fireEvent.change(input('accountNumber')!, { target: { value: '123456780' } })
            fireEvent.change(input('routingNumber')!, { target: { value: '021000021' } })
        })
        await act(async () => {
            ref.current!.handleSubmit()
        })

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({
            address: { street: '1 Via Roma', city: 'Rome', state: 'NY', postalCode: '00100', country: 'USA' },
        })
        expect(container).toBeTruthy()
    })

    it('a state code that belongs to another country is left for the user to pick', async () => {
        // AGU is a Mexican state code. It is not in the US list, so the US form
        // must not carry it into a select that cannot show it.
        mockOwnIdentity = {
            ...KNOWN_IDENTITY,
            address: { ...KNOWN_IDENTITY.address!, state: 'AGU', countryCode: 'US' },
        }
        const onSuccess = jest.fn(async () => ({}))
        const { ref } = renderBareForm(onSuccess, 'USA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))

        await act(async () => {
            fireEvent.change(input('accountNumber')!, { target: { value: '123456780' } })
            fireEvent.change(input('routingNumber')!, { target: { value: '021000021' } })
        })
        await act(async () => {
            ref.current!.handleSubmit()
        })

        // the form refuses to submit without a state, so nothing reaches the provider
        expect(onSuccess).not.toHaveBeenCalled()
    })
})

// ---------- two groups, one screen ----------

/**
 * Six fields in one flat list read as a wall. The screen asks two things
 * instead: what account, and whose. The grouping is in the shared form, so
 * every corridor and both flows get the same two headings in the same order.
 */
describe('DynamicBankAccountForm — the fields are grouped', () => {
    const headings = () => Array.from(document.querySelectorAll('form h3')).map((element) => element.textContent)

    /** The form controls, in the order the DOM has them — which is tab order. */
    const fieldOrder = () =>
        Array.from(document.querySelectorAll('form input[id^="bank-"]')).map((element) => element.id)

    it.each([
        // SEPA needs only the IBAN now; the BIC field is gone
        ['the euro area', 'SEPA', ['bank-accountNumber', 'bank-accountOwnerName']],
        ['the United States', 'USA', ['bank-accountNumber', 'bank-routingNumber', 'bank-accountOwnerName']],
        ['the United Kingdom', 'GBR', ['bank-accountNumber', 'bank-sortCode', 'bank-accountOwnerName']],
        ['Mexico', 'MX', ['bank-clabe', 'bank-accountOwnerName']],
        // Colombia routes by document and bank code, so its account group is longer
        ['Colombia', 'CO', ['bank-accountNumber', 'bank-documentNumber', 'bank-bankCode', 'bank-phoneNumber']],
    ])('%s: the account comes first, then the owner', (_, country, expectedStart) => {
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, country)

        expect(headings()).toEqual(['withdraw.bankForm.groupBankAccount', 'withdraw.bankForm.groupAccountOwner'])
        // the account fields precede the owner's, so tab order matches what is read
        expect(fieldOrder().slice(0, expectedStart.length)).toEqual(expectedStart)
    })

    it('the address is the account owner’s, so it follows the name', () => {
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')
        const order = fieldOrder()
        expect(order.indexOf('bank-accountOwnerName')).toBeLessThan(order.indexOf('bank-street'))
        expect(order.indexOf('bank-street')).toBeLessThan(order.indexOf('bank-city'))
        expect(order.indexOf('bank-city')).toBeLessThan(order.indexOf('bank-postalCode'))
    })

    it('the own-account choice opens the owner group, above the name', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')

        const box = ownAccountBox()!
        const name = input('accountOwnerName')!
        expect(box.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('the claim flow gets the same two groups', () => {
        const onSuccess = jest.fn(async () => ({}))
        const ref = React.createRef<{ handleSubmit: () => void }>()
        render(<DynamicBankAccountForm ref={ref} country="SEPA" flow="claim" error={null} onSuccess={onSuccess} />)
        expect(headings()).toEqual(['withdraw.bankForm.groupBankAccount', 'withdraw.bankForm.groupAccountOwner'])
    })
})

// ---------- an address that arrives, and one that does not belong ----------

describe('DynamicBankAccountForm — where the address is allowed to land', () => {
    it.each([
        ['a US address in a euro form', 'SEPA', 'US'],
        ['a Spanish address in a Mexican form', 'MX', 'ES'],
    ])('%s is not filled in', async (_, corridor, countryCode) => {
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: { ...KNOWN_IDENTITY.address!, countryCode } }
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, corridor)

        // the name still is: it is the person's name whatever country they live in
        await waitFor(() => expect(input('accountOwnerName')!.value).toBe('Anna Rossi'))
        expect(input('street')!.value).toBe('')
        expect(input('city')!.value).toBe('')
        expect(input('postalCode')!.value).toBe('')
    })

    it.each([
        ['a Spanish address in a euro form', 'SEPA', 'ES'],
        ['a US address in a US form', 'USA', 'US'],
        // a US account's owner can live anywhere (Wise USD, held from Lisbon)
        ['a French address in a US form', 'USA', 'FR'],
        ['an address of unknown country', 'SEPA', null],
    ])('%s is filled in', async (_, corridor, countryCode) => {
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: { ...KNOWN_IDENTITY.address!, countryCode } }
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, corridor)

        await waitFor(() => expect(input('city')!.value).toBe('Rome'))
        expect(input('street')!.value).toBe('1 Via Roma')
    })

    /**
     * The verified address is read over the network, so it can land while the
     * user is already typing. What they typed is the answer; only the fields
     * they have not touched take the address.
     */
    it('an address that arrives after the user starts typing never writes over them', async () => {
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: null }
        const onSuccess = jest.fn(async () => ({}))
        const { rerender } = renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('accountOwnerName')!.value).toBe('Anna Rossi'))

        await act(async () => {
            fireEvent.change(input('city')!, { target: { value: 'Milan' } })
        })

        // the read lands
        mockOwnIdentity = KNOWN_IDENTITY
        await act(async () => {
            rerender(<DynamicBankAccountForm country="SEPA" flow="withdraw" error={null} onSuccess={onSuccess} />)
        })

        expect(input('city')!.value).toBe('Milan')
        expect(input('street')!.value).toBe('1 Via Roma')
        expect(input('postalCode')!.value).toBe('00100')
    })
})

// ---------- the address is not told to anyone ----------

/**
 * The address is the user's, read in the user's session, and it goes nowhere
 * else: not to the URL, not to analytics, not to an error report. The two
 * capture functions the form's tree can reach are held here by value, so a
 * later `capture({ ...formValues })` anywhere under it fails this test.
 */
describe('DynamicBankAccountForm — the address goes nowhere else', () => {
    const containsAddress = (calls: unknown[][]) =>
        calls.some((args) => JSON.stringify(args ?? '').match(/Via Roma|Rome|00100|Anna Rossi/))

    it('is not captured, not reported, and not in the URL', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))

        await typeIban(DE_IBAN, { blur: true })
        await submitWithEnter(container)
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))

        expect(containsAddress(mockPosthogCapture.mock.calls)).toBe(false)
        expect(containsAddress(mockSentryCapture.mock.calls)).toBe(false)
        expect(containsAddress(mockSentryBreadcrumb.mock.calls)).toBe(false)
        expect(window.location.search).not.toMatch(/Via Roma|Rome|00100|Anna Rossi/)
    })
})

// ---------- a late prefill never moves the page ----------

/**
 * The button is brought clear of the bottom nav the moment the form becomes
 * submittable. A prefill can make it submittable on its own, and the verified
 * address arrives over the network — so it can land while the user is reaching
 * for the button. Moving the page then moves it under their thumb.
 */
describe('DynamicBankAccountForm — a prefill that lands late', () => {
    it('does not scroll the page and does not take the focus', async () => {
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: null }
        const onSuccess = jest.fn(async () => ({}))
        const { rerender } = renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('accountOwnerName')!.value).toBe('Anna Rossi'))

        // the user has typed the account number; only the address is still missing
        await typeIban(DE_IBAN, { blur: true })
        mockScrollClear.mockClear()
        const focusedBefore = document.activeElement

        // the address lands
        mockOwnIdentity = KNOWN_IDENTITY
        await act(async () => {
            rerender(<DynamicBankAccountForm country="SEPA" flow="withdraw" error={null} onSuccess={onSuccess} />)
        })

        // it completes the form, so the button turns enabled — and still the
        // page does not move, because the user did not do it
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))
        await waitFor(() => expect(screen.getByRole('button', { name: /continue|review/i })).toBeEnabled())
        expect(mockScrollClear).not.toHaveBeenCalled()
        expect(document.activeElement).toBe(focusedBefore)
    })

    /**
     * The form that is submittable only because it was filled in for the user
     * is the same case: nothing the user did asked the page to move.
     */
    it('a form that is submittable from the start does not scroll either', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))
        expect(mockScrollClear).not.toHaveBeenCalled()
    })

    /** What the scroll is for still happens: the user finishes, the page moves. */
    it('still brings the button clear once the USER completes the form', async () => {
        mockOwnIdentity = KNOWN_IDENTITY
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'SEPA')
        await waitFor(() => expect(input('city')!.value).toBe('Rome'))
        mockScrollClear.mockClear()

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(screen.getByRole('button', { name: /continue|review/i })).toBeEnabled())

        expect(mockScrollClear).toHaveBeenCalledWith(screen.getByTestId('bank-form-cta'))
    })
})

// ---------- a US account owned by someone who lives elsewhere ----------

/**
 * A USD account at Wise or a US bank can belong to someone who lives in
 * Lisbon. Bridge wants the owner's own address, in any country ("If the
 * country includes states or provinces, State is also required"; "Must be
 * supplied for US addresses"), so the form asks for the country, starts it at
 * the user's residence, and asks for a state only where the address has one.
 */
describe('DynamicBankAccountForm — the owner of a US account lives anywhere', () => {
    const countryField = () => screen.getByRole('combobox', { name: 'withdraw.bankForm.countryLabel' })
    const stateField = () => screen.queryByText('withdraw.bankForm.stateLabel')

    const typeUsAccount = async () => {
        await act(async () => {
            fireEvent.change(input('accountNumber')!, { target: { value: '123456780' } })
            fireEvent.change(input('routingNumber')!, { target: { value: '021000021' } })
            fireEvent.change(input('accountOwnerName')!, { target: { value: 'Hugo Montenegro' } })
            fireEvent.change(input('street')!, { target: { value: 'Rua Augusta 1' } })
            fireEvent.change(input('city')!, { target: { value: 'Lisboa' } })
            fireEvent.change(input('postalCode')!, { target: { value: '1100-048' } })
        })
    }

    it('starts the country at the residence, and asks no state for a Portuguese address', async () => {
        mockResidence = { declared: 'PT', declaredSecond: null, verified: 'PT' }
        const onSuccess = jest.fn(async () => ({}))
        const { ref } = renderBareForm(onSuccess, 'USA')

        expect(countryField()).toHaveValue('Portugal')
        expect(stateField()).toBeNull()

        await typeUsAccount()
        await act(async () => {
            ref.current!.handleSubmit()
        })

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        const payload = payloadOf(onSuccess)
        // the bank is in the US; the owner's address is in Portugal
        expect(payload).toMatchObject({
            accountType: 'us',
            countryCode: 'USA',
            address: { street: 'Rua Augusta 1', city: 'Lisboa', postalCode: '1100-048', country: 'PRT' },
        })
        expect(payload.address).not.toHaveProperty('state')
    })

    it('asks for a state when the address is in the US, and will not submit without one', async () => {
        mockResidence = { declared: 'US', declaredSecond: null, verified: 'US' }
        const onSuccess = jest.fn(async () => ({}))
        const { ref } = renderBareForm(onSuccess, 'USA')

        expect(countryField()).toHaveValue('United States')
        expect(stateField()).toBeInTheDocument()

        await typeUsAccount()
        await act(async () => {
            ref.current!.handleSubmit()
        })
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('a user with no residence picks the country before the form submits', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { ref } = renderBareForm(onSuccess, 'USA')

        expect(countryField()).toHaveValue('')
        await typeUsAccount()
        await act(async () => {
            ref.current!.handleSubmit()
        })
        expect(onSuccess).not.toHaveBeenCalled()

        await act(async () => {
            fireEvent.click(countryField())
            fireEvent.change(countryField(), { target: { value: 'Argen' } })
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('option', { name: /Argentina/ }))
        })
        expect(stateField()).toBeNull()
        await act(async () => {
            ref.current!.handleSubmit()
        })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({ address: { country: 'ARG' } })
    })

    it('the known address brings its own country, over the residence, and fills the form like the euro one', async () => {
        mockResidence = { declared: 'US', declaredSecond: null, verified: 'US' }
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: { ...KNOWN_IDENTITY.address!, countryCode: 'IT', state: '' } }
        const onSuccess = jest.fn(async () => ({}))
        const { ref } = renderBareForm(onSuccess, 'USA')

        await waitFor(() => expect(input('city')!.value).toBe('Rome'))
        expect(input('street')!.value).toBe('1 Via Roma')
        expect(countryField()).toHaveValue('Italy')
        expect(stateField()).toBeNull()

        await act(async () => {
            fireEvent.change(input('accountNumber')!, { target: { value: '123456780' } })
            fireEvent.change(input('routingNumber')!, { target: { value: '021000021' } })
        })
        await act(async () => {
            ref.current!.handleSubmit()
        })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({
            accountOwnerName: { firstName: 'Anna', lastName: 'Rossi' },
            address: { street: '1 Via Roma', city: 'Rome', postalCode: '00100', country: 'ITA' },
        })
    })

    it('the Mexican and UK forms keep their own country and ask no country question', () => {
        const onSuccess = jest.fn(async () => ({}))
        renderBareForm(onSuccess, 'MX')
        expect(screen.queryByRole('combobox', { name: 'withdraw.bankForm.countryLabel' })).toBeNull()
    })
})
