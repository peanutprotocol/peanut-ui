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
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { fullName: 'John Doe', email: 'john@doe.co' } } }),
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
    address: { street: string; city: string; state: string; postalCode: string } | null
    isLoading: boolean
}
const NOTHING_KNOWN: MockOwnIdentity = { ownerName: null, address: null, isLoading: false }
let mockOwnIdentity: MockOwnIdentity = NOTHING_KNOWN
jest.mock('@/hooks/useOwnAccountIdentity', () => ({
    useOwnAccountIdentity: () => mockOwnIdentity,
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
    address: { street: '1 Via Roma', city: 'Rome', state: 'NY', postalCode: '00100' },
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
        mockOwnIdentity = KNOWN_IDENTITY
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
            address: { street: '1 Via Roma', city: 'Rome', state: 'NY', postalCode: '00100' },
        })
        expect(container).toBeTruthy()
    })

    it('a state code that belongs to another country is left for the user to pick', async () => {
        // AGU is a Mexican state code. It is not in the US list, so the US form
        // must not carry it into a select that cannot show it.
        mockOwnIdentity = { ...KNOWN_IDENTITY, address: { ...KNOWN_IDENTITY.address!, state: 'AGU' } }
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
