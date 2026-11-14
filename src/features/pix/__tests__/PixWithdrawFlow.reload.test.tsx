/** @jest-environment jsdom */
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
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
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockOpenSupport }),
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
    provider: 'manteca',
    state: 'ready',
    candidates: [{ provider: 'manteca', state: 'ready' }],
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
const KEY = '09579927189'
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

    // the shared success view ends it, fed from the entry: reais, USD, the key (no bank after a reload)
    it('shows the shared success view once the provider paid the Pix, with no sound of its own', () => {
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
            `withdraw R$503 $92.50 ${en.pix.withdraw.withdrawnToKey.replace('{key}', '+5511912345678')}`
        )
        // the success view plays the sound; the outcome screen adds none
        expect(screen.queryByTestId('success-sound')).toBeNull()
        expect(screen.queryByRole('button', { name: en.common.done })).toBeNull()
    })

    it('shows the shared payment loader while the provider pays, then "on its way" with Done after 90 seconds', () => {
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

    it('says the withdrawal did not go through when the API cancelled it', () => {
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

    // Manteca's sign kind: nothing opens until the API takes the signed transfer, and its answer names the withdrawal
    it('opens a transfer-then-submit withdrawal at its submit, then drops the form and shows the payment loader', async () => {
        const display = {
            amountBrl: '503.00',
            pixKey: '09579927189',
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
        pixKey: '09579927189',
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
        ownAccount: null,
        holderName: 'Ana Souza',
        bankName: 'Banco Inter',
        withdrawUsd: '92.504310',
        rate: '5.445692',
        fixedFeeBrl: '0.75',
        arrivalEstimateSeconds: 60,
        provider: 'Manteca' as const,
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

    // the Pix-key payment form, with Withdrawing and Confirm (ruling 2026-11-12, providers are cattle)
    it('is the payment form: Withdrawing, the holder and bank, the rate, the sponsored Peanut fee, the provider fee apart, no savings row', async () => {
        mockPreview.mockResolvedValue(display)
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(screen.getByText(en.pix.withdraw.withdrawing)).toBeInTheDocument()
        expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
        expect(screen.getByText('Banco Inter')).toBeInTheDocument()
        expect(screen.getByText('1 USD = 5.445946 BRL')).toBeInTheDocument()
        expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
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

    // a route with a provider's minimum of R$20
    const WITH_MINIMUM: CapabilityRoute = { ...route, limits: { minAmount: '20', currency: 'BRL' } }

    // A bridge fee makes the debit larger than the USD entered. The reais under the amount are the
    // payout per USD entered, never the payout over the debit, and the quote decides the minimum.
    it('converts a USD amount with the provider input, so a bridge fee cannot hold it under the minimum', async () => {
        // the indicative price alone would read USD 4 as R$19.20, under the R$20 minimum
        mockQuote.mockReturnValue({ ...QUOTED, price: { sell: 4.8, buy: 4.8 } })
        mockPreview.mockResolvedValue({ ...display, amountBrl: '20.00', withdrawUsd: '4.100000' })
        withForm({ destination: KEY, amountUsd: '4' })
        renderAt('?step=review', undefined, false, WITH_MINIMUM)

        await waitFor(() => expect(mockPreview).toHaveBeenCalledWith({ pixKey: KEY, amountUsd: '4' }))
        expect(await screen.findByText('$4.10')).toBeInTheDocument()
        expect(screen.getByText('R$20')).toBeInTheDocument()
        // the field converts USD 4 with the payout over the USD entered: R$20, not 20 / 4.10 ≈ R$19.51
        expect(screen.getByText(/≈ R\$ 20(\.00)?$/)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.deposit.minimum.replace('{amount}', 'R$20'))).toBeNull()
        await waitFor(() => expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled())
    })

    it('still refuses typed reais under the minimum before any quote', () => {
        mockPreview.mockResolvedValue(display)
        withForm({ destination: KEY, amountBrl: '10' })
        renderAt('?step=review', undefined, false, WITH_MINIMUM)

        expect(screen.getByText(en.pix.deposit.minimum.replace('{amount}', 'R$20'))).toBeInTheDocument()
        expect(mockPreview).not.toHaveBeenCalled()
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

    // a provider whose fees all sit in the rate sends a zero flat fee: no fee row
    it('shows no provider fee row for a quote without one', async () => {
        mockPreview.mockResolvedValue({ ...display, fixedFeeBrl: '0', bankName: null, provider: 'Manteca' })
        withForm(REVIEW_FORM)
        renderAt('?step=review')

        expect(await screen.findByText('1 USD = 5.437838 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
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

    // Bridge pays another person's key and stores it as a recipient itself; Manteca's save route is not
    // its route, and would refuse a resident whose Pix runs on Bridge with no word on screen (TASK-24910)
    it('on a Bridge route offers no save card and never calls the save, though the funding is sent', async () => {
        const bridgeDisplay = { ...display, ownAccount: false, provider: 'Bridge', amountBrlEstimated: true as const }
        mockPreview.mockResolvedValue(bridgeDisplay)
        mockInit.mockResolvedValue({
            provider: 'bridge',
            intentId: 'b1',
            display: bridgeDisplay,
            sign: {
                kind: 'transfer-then-submit',
                depositAddress: '0x00000000000000000000000000000000000000d3',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '92.504310',
                payAmountUnits: '92504310',
                priceLockCode: 'b1',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
        })
        mockSignSpend.mockResolvedValue({
            strategy: 'smart-only',
            signedUserOp: { signedUserOp: { sender: '0xabc' }, chainId: '42161', entryPointAddress: '0xe' },
        })
        mockSubmitTransfer.mockResolvedValue({ provider: 'bridge', intentId: 'b1', status: 'PENDING' })
        mockEntry.mockReturnValue({ data: undefined, isLoading: true })
        withForm(REVIEW_FORM)
        renderAt('?step=review', undefined, false, {
            ...route,
            provider: 'bridge',
            candidates: [{ provider: 'bridge', state: 'ready' }],
        })

        const confirm = await screen.findByRole('button', { name: en.common.confirm })
        // the holder is on screen, so the card (named after them) would be too, were it offered
        expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
        expect(screen.queryByText(en.global.savedAddresses.savePrompt)).toBeNull()
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)

        await waitFor(() => expect(mockSubmitTransfer).toHaveBeenCalledTimes(1))
        // a Bridge payout takes minutes: the ending is the static one, not the loader
        expect(await screen.findByRole('button', { name: en.common.done })).toBeInTheDocument()
        expect(mockSavePixKey).not.toHaveBeenCalled()
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

    it.each(['PIX_KEY_NOT_OWN', 'PIX_KEY_BLOCKED', 'PIX_KEY_NOT_FOUND'])(
        'the key was refused (%s): Change key opens the key step with the key kept to edit',
        async (code) => {
            refuse(422, code)
            const urls: string[] = []
            renderAt(REVIEW, (event) => urls.push(event.queryString))

            fireEvent.click(await screen.findByRole('button', { name: en.pix.withdraw.changeKey }))

            expect(await screen.findByDisplayValue('09579927189')).toBeInTheDocument()
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
        provider: 'manteca',
        holderName: 'Ana Souza',
        holderTaxIdMasked: '095.***.***-89',
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
        expect(screen.queryByLabelText(en.withdraw.pixKey.placeholder)).toBeNull()
    })

    // the screen's title alone tells them apart (NavHeader, not rendered here)
    it('shows the same key step for a withdrawal and a send: the field, no line above it', () => {
        const withdraw = renderAt('')
        const withdrawText = withdraw.container.textContent
        withdraw.unmount()
        mockFromSend = true
        try {
            const send = renderAt('?sendMethod=bank')
            expect(send.container.textContent).toBe(withdrawText)
            expect(screen.getByLabelText(en.withdraw.pixKey.placeholder)).toBeInTheDocument()
            expect(screen.queryByText(en.withdraw.pixKey.info)).toBeNull()
        } finally {
            mockFromSend = false
        }
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

        expect(screen.getByLabelText(en.withdraw.pixKey.placeholder)).toBeInTheDocument()
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
