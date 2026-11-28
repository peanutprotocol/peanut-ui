/** @jest-environment jsdom */
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PROVIDERS } from '@/constants/providers.consts'
import type { CapabilityRoute } from '@/types/capabilities'
import { ApiError } from '@/services/api-error'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/withdraw/manteca',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
let mockUserId = 'u1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { userId: mockUserId }, accounts: [] } }),
}))
const mockSavePixKey = jest.fn((..._args: unknown[]) => Promise.resolve())
jest.mock('@/services/manteca', () => ({
    mantecaApi: { savePixKey: (...args: unknown[]) => mockSavePixKey(...args) },
}))
const mockOpenSupport = jest.fn()
const mockOpenScanner = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockOpenSupport, setIsQRScannerOpen: mockOpenScanner }),
    useModalsContextOptional: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
let mockFromSend = false
jest.mock('@/hooks/useSendFlowOrigin', () => ({ useSendFlowOrigin: () => ({ isFromSendFlow: mockFromSend }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => <div data-testid="success-sound" /> }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
// the shared success view, as its own suite covers it: here only what the flow hands it
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: ({
        isWithdrawFlow,
        currencyAmount,
        secondaryAmount,
        message,
    }: {
        isWithdrawFlow?: boolean
        currencyAmount?: string
        secondaryAmount?: string
        message?: string
    }) => (
        <div data-testid="payment-success">
            {isWithdrawFlow ? 'withdraw' : 'other'} {currencyAmount} {secondaryAmount} {message}
        </div>
    ),
}))
const QUOTED = {
    code: 'BRL',
    symbol: 'R$',
    price: { sell: 5.4, buy: 5.5 },
    rateAndFee: { exchangeRate: 5.37, providerFeeBrl: '0.98' },
    quotesTypedAmount: false,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
}
const mockQuote = jest.fn((..._args: unknown[]) => QUOTED)
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: (...args: unknown[]) => mockQuote(...args),
}))
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        spendableBalance: 100_000_000n,
        formattedSpendableBalance: '100',
        spendableBalanceDecimal: 100,
        sendTransactions: (...args: unknown[]) => mockSendTransactions(...args),
    }),
}))
const mockPreview = jest.fn()
const mockInit = jest.fn()
const mockSubmitTransfer = jest.fn()
const mockLookup = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        lookupKey: (key: string) => mockLookup(key),
        previewWithdrawal: (request: unknown) => mockPreview(request),
        openWithdrawal: (request: unknown) => mockInit(request),
        submitWithdrawal: (request: unknown) => mockSubmitTransfer(request),
        reportFunding: () => Promise.resolve(),
    },
}))
const mockEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => mockEntry() }))
// the latest history rows: the page must never take one for a withdrawal submitted with no answer
let mockHistoryEntries: unknown[] = []
jest.mock('@/hooks/useTransactionHistory', () => ({
    // the receipt mapper reads the role enum the hook module re-exports; read lazily, as the
    // module that defines it is still loading when this factory runs (an import cycle)
    get EHistoryUserRole() {
        return jest.requireActual('@/utils/history.utils').EHistoryUserRole
    },
    useTransactionHistory: () => ({ data: { entries: mockHistoryEntries, hasMore: false }, refetch: jest.fn() }),
}))
// the transfer-then-submit signer: these withdrawals sign a deposit with its id
const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: (input: unknown) => mockSignSpend(input) }),
}))
jest.mock('@/hooks/wallet/useRainControllerRepair', () => ({ useRainControllerRepair: () => jest.fn() }))
jest.mock('@/hooks/wallet/useSignedSpendRecovery', () => ({ useSignedSpendRecovery: () => jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))

import { PixWithdrawFlow } from '../components/PixWithdrawFlow'
import { forgetPixWithdrawDraft, type PixWithdrawDraft } from '../pixWithdrawDraft'

const route: CapabilityRoute = {
    operation: 'withdraw',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
}
const entry = (status: string, intentStatus?: string) => ({
    data: { uuid: 'w1', status, currency: { amount: '503.00', code: 'BRL' }, extraData: { intentStatus } },
    isLoading: false,
})

// `keepMountUpdates`: the adapter otherwise drops a URL update made while the page mounts
const renderAt = (
    searchParams: string,
    onUrlUpdate?: (event: UrlUpdateEvent) => void,
    keepMountUpdates = false,
    at: CapabilityRoute = route
) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter
                searchParams={searchParams}
                onUrlUpdate={onUrlUpdate}
                hasMemory
                resetUrlUpdateQueueOnMount={!keepMountUpdates}
            >
                <PixWithdrawFlow route={at} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )

// The form lives in the account's draft in this tab's session, never in the URL (`pixWithdrawDraft`).
const KEY = '11144477735'
const REVIEW_FORM = { destination: KEY, amountBrl: '503' }
const DRAFT_KEY = (userId = 'u1') => `pix-withdraw-draft:${userId}`
const withForm = (fields: Partial<PixWithdrawDraft>, userId = 'u1') =>
    window.sessionStorage.setItem(
        DRAFT_KEY(userId),
        JSON.stringify({ destination: '', amountUsd: '', amountBrl: '', spendUsd: '', ...fields })
    )
const storedForm = (userId = 'u1') => JSON.parse(window.sessionStorage.getItem(DRAFT_KEY(userId)) ?? 'null')
beforeEach(() => {
    window.sessionStorage.clear()
    forgetPixWithdrawDraft('u1')
    mockFromSend = false
})

// Send and Withdraw fill the same form: a friend's key typed in Send must never wait, Continue
// enabled, on a screen titled Withdraw, nor the reverse (review finding 2)
describe('the Pix drafts of Send and Withdraw', () => {
    const keyField = () => screen.findByRole('textbox', { name: en.withdraw.pixKey.placeholder })

    it("opens Send with an empty key after a withdrawal's draft", async () => {
        withForm(REVIEW_FORM)
        mockFromSend = true
        renderAt('')
        expect(await keyField()).toHaveValue('')
    })

    it("opens Withdraw with an empty key after a send's draft", async () => {
        window.sessionStorage.setItem(
            'pix-send-draft:u1',
            JSON.stringify({ destination: KEY, amountUsd: '', amountBrl: '503', spendUsd: '' })
        )
        renderAt('')
        expect(await keyField()).toHaveValue('')
    })

    it('keeps the key a send typed for the send', async () => {
        mockFromSend = true
        window.sessionStorage.setItem(
            'pix-send-draft:u1',
            JSON.stringify({ destination: KEY, amountUsd: '', amountBrl: '', spendUsd: '' })
        )
        renderAt('')
        expect(await keyField()).toHaveValue(KEY)
    })
})

describe('PixWithdrawFlow after a reload', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the opened withdrawal, not the filled review, so a second Confirm is not on screen', () => {
        mockEntry.mockReturnValue(entry('PENDING'))
        renderAt('?step=review&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
        expect(mockPreview).not.toHaveBeenCalled()
        expect(mockInit).not.toHaveBeenCalled()
    })

    it('a withdrawal this device never signed reads as not sent, and starts a new one from the key', async () => {
        window.localStorage.clear()
        mockEntry.mockReturnValue(entry('PENDING', 'AWAITING_USER_ACTION'))
        const urls: string[] = []
        renderAt('?step=success&intentId=w1', (event) => urls.push(event.queryString))

        expect(screen.getByText(en.pix.withdraw.notSent)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.tryAgain }))

        await waitFor(() => expect(urls.at(-1)).not.toContain('intentId'))
        // the first step is the key, so the URL is empty again
        expect(await screen.findByRole('textbox', { name: en.withdraw.pixKey.placeholder })).toBeInTheDocument()
        expect(mockInit).not.toHaveBeenCalled()
    })

    it('a withdrawal this device may have signed stays unconfirmed after a reload', () => {
        window.localStorage.setItem('pix-withdraw-sent:w1', '1')
        mockEntry.mockReturnValue(entry('PENDING', 'AWAITING_USER_ACTION'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.tryAgain })).toBeNull()
        window.localStorage.clear()
    })

    // the shared success view ends it, fed from the entry: reais, USD, the key (no bank after a reload)
    it('shows the shared success view once Avenia paid the Pix, with no sound of its own', () => {
        const completed = entry('COMPLETED')
        mockEntry.mockReturnValue({
            ...completed,
            data: {
                ...completed.data,
                amount: '92.50431',
                recipientAccount: { identifier: '+5511912345678', type: 'PIX', isUser: false },
            },
        })
        renderAt('?step=success&intentId=w1')

        expect(screen.getByTestId('payment-success')).toHaveTextContent(
            `withdraw R$503 $92.50 ${en.pix.withdraw.withdrawnToKey.replace('{key}', '11 91234-5678')}`
        )
        // the success view plays the sound; the outcome screen adds none
        expect(screen.queryByTestId('success-sound')).toBeNull()
        expect(screen.queryByRole('button', { name: en.common.done })).toBeNull()
    })

    it('shows the shared payment loader while Avenia pays, then "on its way" with Done after 90 seconds', () => {
        jest.useFakeTimers()
        mockEntry.mockReturnValue(entry('PENDING', 'PROCESSING'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.processingTitle)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.done })).toBeNull()

        act(() => jest.advanceTimersByTime(90_000))

        expect(screen.queryByText(en.pix.withdraw.processingTitle)).toBeNull()
        expect(screen.getByText(en.pix.withdraw.sent)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.done })).toBeInTheDocument()
        jest.useRealTimers()
    })

    it('says nothing left the wallet when the unsigned withdrawal expired', () => {
        mockEntry.mockReturnValue(entry('CANCELLED'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.notSent)).toBeInTheDocument()
    })

    it('a withdrawal that ended in a way this build does not know sends the user to support', () => {
        mockEntry.mockReturnValue(entry('SOMETHING_NEW'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.stuck)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.sent)).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalledWith(true)
    })

    it('without an opened withdrawal, the success step falls back to the form', () => {
        mockEntry.mockReturnValue(entry('PENDING'))
        withForm({ destination: KEY })
        renderAt('?step=success')

        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
    })

    it('puts the opened id in the URL at Confirm and keeps the review while the new quote waits', async () => {
        const display = {
            amountBrl: '503.00',
            pixKey: '11144477735',
            ownAccount: true as const,
            holderName: 'Ana Souza',
            bankName: 'Banco Inter',
            withdrawUsd: '92.504310',
            rate: '5.445692',
            fixedFeeBrl: '0.75',
            arrivalEstimateSeconds: 60,
            provider: 'Avenia' as const,
        }
        mockPreview.mockResolvedValue(display)
        // the opened quote takes more USD: nothing is signed until the user confirms again
        mockInit.mockResolvedValue({
            intentId: 'w2',
            display: { ...display, withdrawUsd: '93.100000' },
            sign: {
                kind: 'deposit-with-id',
                contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '93.100000',
                payAmountUnits: '93100000',
                commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
        })
        const urls: string[] = []
        withForm(REVIEW_FORM)
        renderAt('?step=review', (event) => urls.push(event.queryString))

        const confirm = await screen.findByRole('button', { name: en.common.confirm })
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)

        expect(await screen.findByText(en.pix.withdraw.quoteMoved)).toBeInTheDocument()
        // the opened quote's totals stand next to the notice, before the user confirms them
        expect(screen.getByText('$93.10')).toBeInTheDocument()
        expect(screen.queryByText('$92.50')).toBeNull()
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=w2'))).toBe(true))
        // from the open ticket on, the URL holds the step and the id only; the review stays
        const opened = new URLSearchParams(urls.at(-1))
        expect([...opened.keys()].sort()).toEqual(['intentId', 'step'])
        // the open withdrawal holds the form now: the draft goes
        expect(storedForm()).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled()
        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
    })

    // the other sign kind: nothing opens until the API takes the signed transfer, and its answer names the withdrawal
    it('opens a transfer-then-submit withdrawal at its submit, then drops the form and shows the payment loader', async () => {
        const display = {
            amountBrl: '503.00',
            pixKey: '11144477735',
            ownAccount: null,
            holderName: 'Ana Souza',
            bankName: null,
            withdrawUsd: '92.504310',
            rate: '5.437525',
            fixedFeeBrl: '0',
            arrivalEstimateSeconds: 300,
            provider: 'Manteca',
        }
        mockPreview.mockResolvedValue(display)
        mockInit.mockResolvedValue({
            provider: 'manteca',
            intentId: null,
            display,
            sign: {
                kind: 'transfer-then-submit',
                depositAddress: '0x00000000000000000000000000000000000000d3',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '92.504310',
                payAmountUnits: '92504310',
                priceLockCode: 'lock-1',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
        })
        mockSignSpend.mockResolvedValue({
            strategy: 'smart-only',
            signedUserOp: { signedUserOp: { sender: '0xabc' }, chainId: '42161', entryPointAddress: '0xe' },
        })
        mockSubmitTransfer.mockResolvedValue({ provider: 'manteca', intentId: 'm1', status: 'PROCESSING' })
        mockEntry.mockReturnValue({ data: undefined, isLoading: true })
        const urls: string[] = []
        withForm(REVIEW_FORM)
        renderAt('?step=review', (event) => urls.push(event.queryString))

        const confirm = await screen.findByRole('button', { name: en.common.confirm })
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)

        expect(await screen.findByText(en.pix.withdraw.processingTitle)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.sentTo.replace('{destination}', 'Ana Souza'))).toBeNull()
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=m1'))).toBe(true))
        expect([...new URLSearchParams(urls.at(-1)).keys()].sort()).toEqual(['intentId', 'step'])
        expect(storedForm()).toBeNull()
    })
})

// A transfer-then-submit withdrawal whose submit answer was lost: no intent id, so a device mark
// keeps the page on it after a reload, even with the form still in the URL.
describe('PixWithdrawFlow after a reload with a submit that may have gone out', () => {
    const FORM = '?step=review'
    const SUBMITTED_AT = Date.now() - 60_000
    const display = (amountBrl: string) => ({
        amountBrl,
        pixKey: '11144477735',
        ownAccount: null,
        holderName: 'Ana Souza',
        bankName: null,
        withdrawUsd: '92.504310',
        rate: '5.437838',
        fixedFeeBrl: '0',
        arrivalEstimateSeconds: 300,
        provider: 'Manteca',
    })
    // the account's marks, one key per price lock
    const marks = (
        list: Array<{ lock: string; settleBy: number; amountBrl?: string; submittedAt?: number }>,
        userId = 'u1'
    ) =>
        list.forEach(({ lock, settleBy, amountBrl = '503.00', submittedAt = SUBMITTED_AT }) =>
            window.localStorage.setItem(
                `pix-withdraw-pending:${userId}:${lock}`,
                JSON.stringify({ priceLockCode: lock, display: display(amountBrl), submittedAt, settleBy })
            )
        )
    const SOON = () => Date.now() + 10 * 60_000
    beforeEach(() => {
        jest.clearAllMocks()
        window.localStorage.clear()
        mockUserId = 'u1'
        withForm(REVIEW_FORM)
        mockHistoryEntries = []
        mockEntry.mockReturnValue({ data: undefined, isLoading: false })
    })

    it('shows it as not confirmed yet, never the review and its Confirm', () => {
        marks([{ lock: 'lock-a', settleBy: SOON() }])
        renderAt(FORM)

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
        expect(mockPreview).not.toHaveBeenCalled()
    })

    // two tabs, each with a lost answer: the page shows the newest and holds while either stands
    it('shows the newest of two standing marks', () => {
        marks([
            { lock: 'lock-a', settleBy: SOON(), amountBrl: '503.00' },
            { lock: 'lock-b', settleBy: SOON(), amountBrl: '120.00', submittedAt: SUBMITTED_AT + 5_000 },
        ])
        renderAt(FORM)

        expect(screen.getByText('R$120')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
    })

    // nothing in history names the lock: an earlier withdrawal of the same amount must not lift it
    it('stands until its deadline whatever history shows, even a same-amount withdrawal', () => {
        marks([{ lock: 'lock-a', settleBy: SOON() }])
        mockHistoryEntries = [
            {
                uuid: 'older',
                amount: '92.50431',
                timestamp: new Date(SUBMITTED_AT - 60_000),
                extraData: { kind: 'OFFRAMP' },
            },
            {
                uuid: 'm1',
                amount: '92.50431',
                timestamp: new Date(SUBMITTED_AT + 5_000),
                extraData: { kind: 'OFFRAMP' },
            },
        ]
        const urls: string[] = []
        renderAt(FORM, (event) => urls.push(event.queryString))

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(urls.some((url) => url.includes('intentId'))).toBe(false)
        expect(window.localStorage.getItem('pix-withdraw-pending:u1:lock-a')).not.toBeNull()
    })

    // another tab's submit lost its answer while this one shows the review: this page holds too
    it("holds an open page when another tab's mark arrives", async () => {
        mockPreview.mockReturnValue(new Promise(() => {}))
        renderAt(FORM)
        expect(await screen.findByRole('button', { name: en.common.confirm })).toBeInTheDocument()

        marks([{ lock: 'lock-b', settleBy: SOON(), amountBrl: '120.00' }])
        act(() => {
            window.dispatchEvent(new StorageEvent('storage', { key: 'pix-withdraw-pending:u1:lock-b' }))
        })

        expect(await screen.findByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.getByText('R$120')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
    })

    it("never reads another account's marks, and leaves them where they are", async () => {
        marks([{ lock: 'lock-a', settleBy: SOON() }], 'someone-else')
        mockPreview.mockReturnValue(new Promise(() => {}))
        renderAt(FORM)

        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
        expect(await screen.findByRole('button', { name: en.common.confirm })).toBeInTheDocument()
        expect(window.localStorage.getItem('pix-withdraw-pending:someone-else:lock-a')).not.toBeNull()
    })

    it("lets a new withdrawal through once every mark's window has passed, and prunes them", async () => {
        marks([{ lock: 'lock-a', settleBy: Date.now() - 1_000 }])
        mockPreview.mockReturnValue(new Promise(() => {}))
        renderAt(FORM)

        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
        expect(await screen.findByRole('button', { name: en.common.confirm })).toBeInTheDocument()
        await waitFor(() => expect(window.localStorage.getItem('pix-withdraw-pending:u1:lock-a')).toBeNull())
    })
})

describe('PixWithdrawFlow form', () => {
    beforeEach(() => jest.clearAllMocks())
    afterEach(() => mockQuote.mockReturnValue(QUOTED))
    const display = {
        amountBrl: '503.00',
        pixKey: KEY,
        ownAccount: true as const,
        holderName: 'Ana Souza',
        bankName: 'Banco Inter',
        withdrawUsd: '92.504310',
        rate: '5.445692',
        fixedFeeBrl: '0.75',
        // the variable fees in the rate, the flat fee as the row: 92.504310 × 5.445692 − 0.75 = R$503.00
        exchangeRate: '5.445692',
        providerFeeBrl: '0.75',
        arrivalEstimateSeconds: 60,
        provider: 'Avenia' as const,
    }

    it('quotes only while the form is on screen', () => {
        mockPreview.mockReturnValue(new Promise(() => {}))
        const enabledAt = (search: string, form: Partial<PixWithdrawDraft>) => {
            mockQuote.mockClear()
            withForm(form)
            const view = renderAt(search)
            const enabled = mockQuote.mock.calls.at(-1)?.[3]
            view.unmount()
            return enabled
        }
        expect(enabledAt('?step=review', { destination: KEY })).toBe(true)
        expect(enabledAt('?step=pix-key', {})).toBe(false)
    })

    it('shows reais with the R$ symbol, as the deposit amount does', () => {
        mockPreview.mockReturnValue(new Promise(() => {}))
        withForm({ destination: KEY })
        renderAt('?step=review')
        expect(screen.getByText('R$')).toBeInTheDocument()
        expect(screen.queryByText('BRL')).toBeNull()
    })

    it('offers a retry, not a spinner, when the quote fails', () => {
        const refetch = jest.fn()
        mockQuote.mockReturnValue({ ...QUOTED, price: null, isError: true, refetch } as never)
        withForm({ destination: KEY })
        renderAt('?step=review')

        expect(screen.getByText(en.errors.rateUnavailable)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: en.common.retry }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })

    // API-CONTRACT-M3 section 6: the review names whom a send pays, after a reload too
    it("reads a send to another person's key from the quote: Sending, the holder, the punctuated key and masked CPF", async () => {
        mockPreview.mockResolvedValue({
            ...display,
            pixKey: '+5511987654321',
            ownAccount: false,
            holderName: 'Bruno Lima',
            holderTaxIdMasked: '***.456.789-**',
            bankName: 'Nubank',
        })
        withForm({ destination: '+5511987654321', amountBrl: '503' })
        renderAt('?step=review')

        expect(await screen.findByText('Bruno Lima')).toBeInTheDocument()
        expect(screen.getByText(en.payment.confirm.sending)).toBeInTheDocument()
        expect(screen.getByText(/^11 98765-4321 ·$/)).toBeInTheDocument()
        expect(screen.getByText('CPF ***.456.789-**')).toBeInTheDocument()
    })

    // the Pix-key payment form, with Withdrawing and Confirm (ruling 2026-11-12, providers are cattle)
    it('is the payment form: Withdrawing, the holder and bank, the rate, the sponsored Peanut fee, the flat provider fee, no savings row', async () => {
        mockPreview.mockResolvedValue(display)
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
        expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        expect(await screen.findByText('1 USD = 5.45 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.common.sponsoredByPeanut)).toBeNull()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText(en.withdraw.bank.arrives)).toBeNull()
        // "Save to favorites", as the payment form offers it, named after the holder
        expect(screen.getByText(en.global.savedAddresses.savePrompt)).toBeInTheDocument()
        expect(await screen.findByDisplayValue('Ana Souza')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled())
        // the Total is the quote's 92.504310 USDC, and the field converts with it too: no R$503 / 5.4 ≈ 93.15 anywhere
        expect(screen.getByText(en.withdraw.confirm.youPay)).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        expect(screen.queryByText(/93\.1\d/)).toBeNull()
        // typed reais are credited as typed: no payout row
        expect(screen.queryByText(en.withdraw.bank.bankReceives)).toBeNull()
    })

    // a route with the provider's minimum, as Avenia's carries R$5 for a payout (ruling of 15 Nov)
    const WITH_MINIMUM: CapabilityRoute = { ...route, limits: { minAmount: '5', currency: 'BRL' } }

    // A bridge fee makes the debit larger than the USD entered. The reais under the amount are the
    // payout per USD entered, never the payout over the debit, and the quote decides the minimum.
    it('converts a USD amount with the provider input, so a bridge fee cannot hold it under the minimum', async () => {
        // the indicative price alone would read USD 1 as R$4.80, under the R$5 minimum
        mockQuote.mockReturnValue({ ...QUOTED, price: { sell: 4.8, buy: 4.8 } })
        mockPreview.mockResolvedValue({ ...display, amountBrl: '5.00', withdrawUsd: '1.100000' })
        withForm({ destination: KEY, amountUsd: '1' })
        renderAt('?step=review', undefined, false, WITH_MINIMUM)

        await waitFor(() => expect(mockPreview).toHaveBeenCalledWith({ pixKey: KEY, amountUsd: '1' }))
        expect(await screen.findByText('$1.10')).toBeInTheDocument()
        expect(screen.getByText('R$5')).toBeInTheDocument()
        // the field converts USD 1 with the payout over the USD entered: R$5, not 5 / 1.10 ≈ R$4.55
        expect(screen.getByText(/≈ R\$ 5(\.00)?$/)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.deposit.minimum.replace('{amount}', 'R$5'))).toBeNull()
        await waitFor(() => expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled())
    })

    it('still refuses typed reais under the minimum before any quote', () => {
        mockPreview.mockResolvedValue(display)
        withForm({ destination: KEY, amountBrl: '3' })
        renderAt('?step=review', undefined, false, WITH_MINIMUM)

        expect(screen.getByText(en.pix.deposit.minimum.replace('{amount}', 'R$5'))).toBeInTheDocument()
        expect(mockPreview).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
    })

    // Aleks, 16 Nov 2026: R$1 showed the minimum twice, as the line under the amount and as the API's refusal
    // of an amount the preview had quoted while the next one was typed
    it('shows the minimum once, as the box under the amount, and quotes only the amount on screen', async () => {
        const minimum = en.pix.deposit.minimum.replace('{amount}', 'R$5')
        mockPreview.mockImplementation((request: { amountBrl?: string }) =>
            request.amountBrl === '3'
                ? Promise.reject(new ApiError('refused', { status: 422, code: 'PIX_MIN_AMOUNT' }))
                : Promise.resolve(display)
        )
        withForm({ destination: KEY, amountBrl: '3' })
        renderAt('?step=review', undefined, false, WITH_MINIMUM)
        const field = screen.getByPlaceholderText('0.00')

        fireEvent.change(field, { target: { value: '30' } })
        await waitFor(() => expect(mockPreview).toHaveBeenCalledWith({ pixKey: KEY, amountBrl: '30' }))
        await waitFor(() => expect(storedForm().amountBrl).toBe('30'))
        fireEvent.change(field, { target: { value: '3' } })
        await waitFor(() => expect(storedForm().amountBrl).toBe('3'))

        expect(mockPreview).not.toHaveBeenCalledWith(expect.objectContaining({ amountBrl: '3' }))
        expect(screen.getAllByText(minimum)).toHaveLength(1)
        expect(screen.getByRole('alert')).toHaveTextContent(minimum)
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
    })

    // the user typed USD: the reais are the quote's, so the form names them next to the total
    it('shows the exact reais the quote pays out for an amount typed in USD', async () => {
        mockPreview.mockResolvedValue({ ...display, amountBrl: '270.00', withdrawUsd: '50.000000' })
        withForm({ destination: KEY, amountUsd: '50' })
        renderAt('?step=review')

        await waitFor(() => expect(mockPreview).toHaveBeenCalledWith({ pixKey: KEY, amountUsd: '50' }))
        expect(await screen.findByText('R$270')).toBeInTheDocument()
        expect(screen.getByText(en.withdraw.bank.bankReceives)).toBeInTheDocument()
        expect(screen.getByText('$50')).toBeInTheDocument()
    })

    // Chip on ui#4106 (the QR review lost its rows while signing): the withdrawal's rows and provider come from
    // the review and the route, so they stay while the passkey is open
    it('keeps Avenia’s rate, its fee and the provider row while the passkey is open', async () => {
        mockPreview.mockResolvedValue(display)
        mockInit.mockResolvedValue({
            intentId: 'w3',
            display,
            sign: {
                kind: 'deposit-with-id',
                contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '92.504310',
                payAmountUnits: '92504310',
                commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
        })
        mockSendTransactions.mockReturnValue(new Promise(() => {}))
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        const confirm = await screen.findByRole('button', { name: en.common.confirm })
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)
        await waitFor(() => expect(mockSendTransactions).toHaveBeenCalledTimes(1))
        // the passkey prompt is open: the same figures and the same provider
        expect(screen.getByText('1 USD = 5.45 BRL')).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['avenia-br'].brand)).toBeInTheDocument()
    })

    // the API sends the pair only where it is proven: Avenia's review then shows neither row, never the
    // legacy rate or flat fee
    it('shows neither the rate nor the fee row for an Avenia review without the pair', async () => {
        const { exchangeRate: _rate, providerFeeBrl: _fee, ...withoutPair } = display
        mockPreview.mockResolvedValue(withoutPair)
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('$92.50')).toBeInTheDocument())
        expect(screen.queryByText(/^1 USD =/)).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByText('R$0.75')).toBeNull()
    })

    it('holds Confirm while the amount changes and until its quote arrives, then shows the exact total and keeps the amount', async () => {
        let quoteNext: (value: unknown) => void = () => {}
        mockPreview.mockImplementation((request: { amountBrl?: string }) =>
            request.amountBrl === '300'
                ? new Promise((resolve) => {
                      quoteNext = resolve
                  })
                : Promise.resolve(display)
        )
        withForm(REVIEW_FORM)
        renderAt('?step=review')
        const confirm = screen.getByRole('button', { name: en.common.confirm })
        await waitFor(() => expect(confirm).toBeEnabled())

        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '300' } })

        expect(confirm).toBeDisabled()
        await waitFor(() => expect(mockPreview).toHaveBeenCalledWith(expect.objectContaining({ amountBrl: '300' })))
        // settled, but the quote of R$300 is still out: no estimate stands in for the total
        expect(confirm).toBeDisabled()
        expect(screen.queryByText('$92.50')).toBeNull()
        expect(storedForm().amountBrl).toBe('300')

        await act(async () => quoteNext({ ...display, amountBrl: '300.00', withdrawUsd: '55.400000' }))

        await waitFor(() => expect(confirm).toBeEnabled())
        expect(screen.getByText('$55.40')).toBeInTheDocument()
    })

    // "Save to favorites" as the payment offers it: the key, named after its holder, saved once the funding is sent
    it('offers to save the key under its holder, and saves it once the funding is sent', async () => {
        mockPreview.mockResolvedValue(display)
        mockInit.mockResolvedValue({
            intentId: 'w3',
            display,
            sign: {
                kind: 'deposit-with-id',
                contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '92.504310',
                payAmountUnits: '92504310',
                commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
        })
        mockSendTransactions.mockResolvedValue({ receipt: { transactionHash: '0x1', status: 'success', logs: [] } })
        mockEntry.mockReturnValue({ data: undefined, isLoading: true })
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(await screen.findByText(en.global.savedAddresses.savePrompt)).toBeInTheDocument()
        expect(await screen.findByDisplayValue('Ana Souza')).toBeInTheDocument()
        const confirm = screen.getByRole('button', { name: en.common.confirm })
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)

        expect(await screen.findByText(en.pix.withdraw.processingTitle)).toBeInTheDocument()
        await waitFor(() => expect(mockSavePixKey).toHaveBeenCalledWith(KEY, 'Ana Souza'))
    })
})

describe('PixWithdrawFlow refused preview', () => {
    beforeEach(() => jest.clearAllMocks())
    const refuse = (status: number, code: string) =>
        mockPreview.mockRejectedValue(new ApiError('refused', { status, code }))
    const REVIEW = '?step=review'
    beforeEach(() => withForm(REVIEW_FORM))

    it('over the monthly limit: the form says so, the amount stays on screen to change, the key kept', async () => {
        refuse(422, 'PIX_LIMIT_EXCEEDED')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.withdraw.errors.limitExceeded)).toBeInTheDocument()
        expect(screen.getByPlaceholderText('0.00')).toBeEnabled()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        expect(storedForm().destination).toBe(KEY)
    })

    // a paused or dormant provider answers 503: the route may say so now, so the capabilities are read again
    it('a paused provider: Retry, and the route read again', async () => {
        refuse(503, 'PROVIDER_UNAVAILABLE')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.unavailable)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument()
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
    })

    it('withdrawals still on their way: no retry, the message says to try later, Confirm off', async () => {
        refuse(409, 'WITHDRAWAL_IN_PROGRESS')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.withdraw.errors.inProgress)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled()
    })

    it('under the minimum: the message, no retry, the amount stays on screen to change', async () => {
        refuse(422, 'PIX_MIN_AMOUNT')
        renderAt(REVIEW)

        await waitFor(() => expect(screen.getByRole('button', { name: en.common.confirm })).toBeDisabled())
        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        expect(screen.getByPlaceholderText('0.00')).toBeEnabled()
    })

    // API-CONTRACT-M3 §6: the refusal names the provider's own minimum, which can differ from the route's
    it('under the minimum: names the reais the refusal states', async () => {
        mockPreview.mockRejectedValue(
            new ApiError('The minimum is R$25.', {
                status: 400,
                code: 'PIX_MIN_AMOUNT',
                minimum: { amount: '25', currency: 'BRL' },
            })
        )
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.deposit.minimum.replace('{amount}', 'R$25'))).toBeInTheDocument()
    })

    it.each(['PIX_KEY_BLOCKED', 'PIX_KEY_NOT_FOUND'])(
        'the key was refused (%s): Change key opens the key step with the key kept to edit',
        async (code) => {
            refuse(422, code)
            const urls: string[] = []
            renderAt(REVIEW, (event) => urls.push(event.queryString))

            fireEvent.click(await screen.findByRole('button', { name: en.pix.withdraw.changeKey }))

            expect(await screen.findByDisplayValue('11144477735')).toBeInTheDocument()
            expect(urls.at(-1)).not.toContain('destination')
            expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        }
    )

    it('the provider rejected the account: no retry and no edit, the message says what to do', async () => {
        refuse(403, 'PROVIDER_REJECTED')
        renderAt(REVIEW)

        expect(await screen.findByText(en.errors.providerRejected)).toBeInTheDocument()
        for (const name of [en.common.retry, en.pix.withdraw.changeKey]) {
            expect(screen.queryByRole('button', { name })).toBeNull()
        }
    })

    // API review 2 (abeb3b909): a Pix code where a key belongs is refused before any provider is asked
    it('a Pix code refused as a key: the key step’s own line, and Scan QR opens the scanner', async () => {
        refuse(400, 'PIX_KEY_IS_QR_CODE')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.withdraw.notACode)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.navigation.scanQr }))
        expect(mockOpenScanner).toHaveBeenCalledWith(true)
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
    })

    it('the quote changed: Retry asks for the preview again', async () => {
        refuse(409, 'PIX_QUOTE_CHANGED')
        renderAt(REVIEW)

        fireEvent.click(await screen.findByRole('button', { name: en.common.retry }))

        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2))
    })
})

// A Pix key is a CPF, a phone number or an email: it never rides in the URL, where it would reach
// analytics, the browser history and the request logs (`pixWithdrawDraft`)
describe('PixWithdrawFlow form draft', () => {
    const OWN_KEY = {
        provider: 'avenia',
        holderName: 'Ana Souza',
        holderTaxIdMasked: '111.***.***-35',
        bankName: 'Banco Inter',
        ispb: '00416968',
        ownAccount: true,
        blocked: false,
    }
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserId = 'u1'
        mockPreview.mockReturnValue(new Promise(() => {}))
        mockLookup.mockResolvedValue(OWN_KEY)
    })
    afterEach(() => jest.restoreAllMocks())

    it('keeps a typed key in the draft, not the URL, and a refresh restores the form', async () => {
        const urls: string[] = []
        const view = renderAt('', (event) => urls.push(event.queryString))
        fireEvent.change(screen.getByLabelText(en.withdraw.pixKey.placeholder), { target: { value: KEY } })
        await screen.findByTestId('pix-key-holder')
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))

        await waitFor(() => expect(urls.at(-1)).toBe('?step=review'))
        expect(storedForm()).toEqual({ destination: KEY, amountUsd: '', amountBrl: '', spendUsd: '' })

        // the reload opens the URL the user was on: the form, its key from the draft
        view.unmount()
        renderAt('?step=review')
        expect(screen.getByText('R$')).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: en.withdraw.pixKey.placeholder })).toBeNull()
    })

    it('reviews the key and amount the draft holds', () => {
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(mockPreview).toHaveBeenCalledWith(expect.objectContaining({ pixKey: KEY, amountBrl: '503' }))
    })

    // an old link or a tab left open from an earlier build
    it('moves a form in the URL into the draft and replaces the URL without it', async () => {
        const urls: string[] = []
        renderAt(
            `?step=review&destination=${KEY}&destinationAmount=503&sendMethod=bank`,
            (event) => urls.push(event.queryString),
            true
        )

        await waitFor(() => expect(urls.at(-1)).toBe('?step=review&sendMethod=bank'))
        expect(storedForm()).toEqual({ destination: KEY, amountUsd: '', amountBrl: '503', spendUsd: '' })
        expect(mockPreview).toHaveBeenCalledWith(expect.objectContaining({ pixKey: KEY, amountBrl: '503' }))
    })

    it("never reads another account's draft, and leaves it where it is", () => {
        withForm(REVIEW_FORM, 'someone-else')
        renderAt('?step=review')

        expect(screen.getByRole('textbox', { name: en.withdraw.pixKey.placeholder })).toBeInTheDocument()
        expect(mockPreview).not.toHaveBeenCalled()
        expect(storedForm('someone-else').destination).toBe(KEY)
    })

    // private mode, blocked or full storage: the form holds in memory, and only a refresh loses it
    it('carries on without session storage', async () => {
        const failing = (key: string) => {
            if (key.startsWith('pix-withdraw-draft')) throw new DOMException('denied', 'SecurityError')
        }
        const setItem = Storage.prototype.setItem
        const getItem = Storage.prototype.getItem
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
            failing(key)
            setItem.call(this, key, value)
        })
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
            failing(key)
            return getItem.call(this, key)
        })
        const urls: string[] = []
        renderAt('', (event) => urls.push(event.queryString))
        fireEvent.change(screen.getByLabelText(en.withdraw.pixKey.placeholder), { target: { value: KEY } })
        await screen.findByTestId('pix-key-holder')
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))

        await waitFor(() => expect(urls.at(-1)).toBe('?step=review'))
        expect(screen.getByText('R$')).toBeInTheDocument()
        expect(window.sessionStorage.length).toBe(0)
    })
})
