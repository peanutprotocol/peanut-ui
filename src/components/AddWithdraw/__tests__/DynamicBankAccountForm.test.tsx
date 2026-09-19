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

// `getBicFromIban` is NOT mocked: it reads a table bundled with the app, so the
// IBAN tests below run against the real derivation (and its real gaps).

// the two provider checks are network calls
const mockValidateBankAccount = jest.fn(async (_account: string) => true)
const mockValidateBic = jest.fn(async (_bic: string) => true)
jest.mock('@/utils/bridge-accounts.utils', () => ({
    ...jest.requireActual('@/utils/bridge-accounts.utils'),
    validateBankAccount: (account: string) => mockValidateBankAccount(account),
    validateBic: (bic: string) => mockValidateBic(bic),
}))

const mockReadClipboard = jest.fn()
jest.mock('@/utils/clipboard-extract.utils', () => ({
    ...jest.requireActual('@/utils/clipboard-extract.utils'),
    readClipboard: () => mockReadClipboard(),
}))

jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ info: jest.fn(), error: jest.fn(), success: jest.fn(), warning: jest.fn() }),
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
    mockValidateBic.mockResolvedValue(true)
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
const DE_BIC = 'COBADEFFXXX'
const DE_IBAN_OTHER_BANK = 'DE75512108001245126199'
const DE_BIC_OTHER_BANK = 'SOGEDEFFXXX'
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

describe('DynamicBankAccountForm — the BIC follows the IBAN', () => {
    it('an IBAN the table knows: the BIC field hides and the derived BIC is submitted', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)
        expect(bicInput()).toBeInTheDocument()

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())

        await submitWithEnter(container)
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({
            accountType: 'iban',
            accountNumber: DE_IBAN,
            bic: DE_BIC,
            countryCode: 'DEU',
        })
    })

    it('an IBAN the table does not know: the BIC field stays, is required, and an empty one blocks submit', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess, 'ITA')

        await typeIban(IT_IBAN, { blur: true })
        expect(bicInput()).toBeInTheDocument()
        // the label no longer says the field is optional
        expect(screen.getByText('withdraw.bankForm.bic')).toBeInTheDocument()
        expect(screen.queryByText('withdraw.bankForm.bicOptional')).not.toBeInTheDocument()

        await submitWithEnter(container)
        expect(onSuccess).not.toHaveBeenCalled()

        // touching the empty field names the problem
        await act(async () => {
            fireEvent.blur(bicInput()!)
        })
        expect(await screen.findByText('withdraw.bankForm.bicRequired')).toBeInTheDocument()
    })

    it('an IBAN the table does not know: a typed BIC is submitted with it', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess, 'ITA')

        await typeIban(IT_IBAN, { blur: true })
        await act(async () => {
            fireEvent.change(bicInput()!, { target: { value: 'BPMOIT22XXX' } })
        })
        await act(async () => {
            fireEvent.blur(bicInput()!)
        })

        await submitWithEnter(container)
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({ accountNumber: IT_IBAN, bic: 'BPMOIT22XXX', countryCode: 'ITA' })
    })

    it('IBAN A then IBAN B (blurred): the BIC derived for A is cleared and never submitted', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())

        await typeIban(IT_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).toBeInTheDocument())
        expect(bicInput()!.value).toBe('')

        await submitWithEnter(container)
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('IBAN A then IBAN B with Enter and no blur: the hidden BIC of A is not sent with B', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())

        await typeIban(IT_IBAN, { blur: false })
        await submitWithEnter(container)

        expect(onSuccess).not.toHaveBeenCalled()
        // the field is back, empty, and says why the submit stopped
        await waitFor(() => expect(bicInput()).toBeInTheDocument())
        expect(bicInput()!.value).toBe('')
        expect(await screen.findByText('withdraw.bankForm.bicRequired')).toBeInTheDocument()
    })

    it('IBAN A then another derivable IBAN with Enter and no blur: the BIC of the new IBAN is sent', async () => {
        const onSuccess = jest.fn(async () => ({}))
        const { container } = renderIbanForm(onSuccess)

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())

        await typeIban(DE_IBAN_OTHER_BANK, { blur: false })
        await submitWithEnter(container)

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({ accountNumber: DE_IBAN_OTHER_BANK, bic: DE_BIC_OTHER_BANK })
    })

    it('clearing the IBAN drops the BIC that was derived from it', async () => {
        const onSuccess = jest.fn(async () => ({}))
        renderIbanForm(onSuccess)

        await typeIban(DE_IBAN, { blur: true })
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())

        await typeIban('', { blur: true })
        await waitFor(() => expect(bicInput()).toBeInTheDocument())
        expect(bicInput()!.value).toBe('')
    })
})

describe('DynamicBankAccountForm — tap-to-paste', () => {
    const pasteButtonFor = (input: HTMLElement) =>
        input.closest('.relative')!.parentElement!.querySelector('button[aria-label="withdraw.bankForm.pasteAria"]')!

    it('pasting an IBAN validates it, derives the BIC and enables Continue with no manual blur', async () => {
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
        await waitFor(() => expect(bicInput()).not.toBeInTheDocument())
        await waitFor(() => expect(submit).toBeEnabled())

        await act(async () => {
            fireEvent.click(submit)
        })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(payloadOf(onSuccess)).toMatchObject({ accountNumber: DE_IBAN, bic: DE_BIC })
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
