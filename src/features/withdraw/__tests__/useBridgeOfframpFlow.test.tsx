/**
 * Bank offramp submit path — the money leg of the withdraw rebuild
 * (createOfframp → sendMoney → confirmOfframp), exercised through the REAL
 * useBridgeOfframpFlow hook under the nuqs testing adapter (Chip review
 * round 4).
 *
 * The headline regression: the submit handler must be a fresh closure every
 * render. A useCallback with lifetime-stable deps froze the FIRST render's
 * gate/balance, so a click after capabilities resolved ran the stale
 * `gate.kind === 'loading'` no-op forever (dead button until remount).
 */
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

// ---------- module-level mocks ----------

const mockRouterReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useParams: () => ({ country: 'us' }),
    useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// namespaced key-echo so error copy is assertable per namespace
jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        WITHDRAW_CONFIRMED: 'withdraw_confirmed',
        WITHDRAW_COMPLETED: 'withdraw_completed',
        WITHDRAW_FAILED: 'withdraw_failed',
    },
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
}))

jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

// mutable: a mined revert is the one on-chain outcome that proves nothing was paid
let mockTxReverted = false
jest.mock('@/utils/general.utils', () => ({
    isTxReverted: () => mockTxReverted,
}))

jest.mock('@/utils/bridge-accounts.utils', () => ({
    getBridgeChainName: () => 'arbitrum',
}))

// mutable country so the GB/MX rail-minimum cases can flip the destination.
// Records mirror the REAL country table shapes — the UK is { id: 'GBR',
// iso2: 'GB' }, which is exactly what round 6 caught an id-keyed ternary on.
let mockCountryId = 'US'
// mutable rail: the reference rides a different request field on each rail
let mockOfframpConfig = { currency: 'usd', paymentRail: 'ach' }
jest.mock('@/utils/bridge.utils', () => ({
    getOfframpConfigFromAccount: () => mockOfframpConfig,
    getCountryFromPath: () =>
        mockCountryId === 'GB'
            ? { id: 'GBR', iso2: 'GB', title: 'United Kingdom' }
            : { id: 'US', iso2: 'US', title: 'United States' },
    railJurisdictionForBank: () => 'US',
    // mirrors the real per-country local-currency minimums ($1 / £3 / 50 MXN)
    getMinimumAmount: (id: string) => (id === 'MX' ? 50 : id === 'GB' || id === 'GBR' ? 3 : 1),
}))

// The public withdrawal rate (net of Peanut's margin while collected): the
// shared minimum's source when the account has no quote currency. An account
// with one converts the minimum with its quote instead.
let mockExchangeRate: string | null | undefined = '0.79'
let mockExchangeRateError = false
const mockExchangeRateCalls: Array<{ currency: string; enabled?: boolean }> = []
jest.mock('@/hooks/useOfframpRate', () => ({
    useOfframpRate: (currency: string, { enabled }: { enabled?: boolean } = {}) => {
        mockExchangeRateCalls.push({ currency, enabled })
        return {
            rate: mockExchangeRateError || !mockExchangeRate ? null : Number(mockExchangeRate),
            isError: mockExchangeRateError,
        }
    },
}))

// a withdrawal quoted in its bank currency (TASK-23054): the quote the review
// shows and funds. Its rate (local currency per 1 USD) also converts the rail minimum.
type MockQuote = {
    destinationCurrency: string
    rate: string
    updatedAt: string
    sourceAmount: string
    destinationAmount: string
    pricing: 'bridge_rate' | 'fixed_output'
    quoteId?: string
    expiresAt?: string
}
let mockQuote: MockQuote | null = null
let mockQuoteReceivedAt = Date.now()
// what the real hook does on discard: hide that quote until another one lands
let mockDiscardedQuoteId: string | null = null
// the last refresh failed: the quote stays, but is no longer current
let mockQuoteError = false
const mockQuoteRefetch = jest.fn()
const mockQuoteDiscard = jest.fn((quoteId: string) => {
    mockDiscardedQuoteId = quoteId
})
type MockQuoteArgs = {
    currency: string | null
    amount?: { destinationAmount: string } | { sourceAmount: string }
    enabled?: boolean
}
const mockQuoteCalls: MockQuoteArgs[] = []
jest.mock('@/hooks/useBridgeOfframpQuote', () => ({
    useBridgeOfframpQuote: (args: MockQuoteArgs) => {
        mockQuoteCalls.push(args)
        const quote =
            args.currency && mockQuote && !(mockQuote.quoteId && mockQuote.quoteId === mockDiscardedQuoteId)
                ? mockQuote
                : null
        return {
            quote,
            receivedAt: mockQuoteReceivedAt,
            isFetching: false,
            isError: !!args.currency && mockQuoteError,
            refetch: mockQuoteRefetch,
            discard: mockQuoteDiscard,
        }
    },
}))

const bridgeRateQuote = (overrides: Partial<MockQuote> = {}): MockQuote => ({
    destinationCurrency: 'eur',
    rate: '0.8955',
    updatedAt: '2026-09-24T15:54:16.373Z',
    sourceAmount: '2233.39',
    destinationAmount: '2000.00',
    pricing: 'bridge_rate',
    ...overrides,
})

// the fees-v2 quote: 0.30% inside the rate, both amounts fixed, signed for create
const fixedOutputQuote = (overrides: Partial<MockQuote> = {}): MockQuote =>
    bridgeRateQuote({
        rate: '0.8928135',
        sourceAmount: '2240.11',
        pricing: 'fixed_output',
        quoteId: 'quote-1',
        expiresAt: '2026-09-24T15:56:16.373Z',
        ...overrides,
    })

jest.mock('@/utils/regions.utils', () => ({
    isBridgeSupportedCountry: () => true,
}))

jest.mock('@/utils/capability-gate', () => ({
    isVerifiableGate: () => true,
}))

jest.mock('@/utils/eea-uplift.utils', () => ({
    upliftTriggerFromGate: () => null,
    upliftTriggerFromAdvisory: () => null,
}))

jest.mock('@/utils/native-routes', () => ({
    withdrawCountryUrl: (country: string, marker: string) => `/withdraw/${country}${marker}`,
}))

jest.mock('@/utils/settled-tx-hash.utils', () => ({
    resolveSettledTxHash: ({ txHash }: { txHash?: string }) => ({ hash: txHash ?? null }),
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

// mutable: the recovery cases assert the send marker rides along
let mockIsBankFromSend = false
jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isBankFromSend: mockIsBankFromSend }),
}))

const mockPointsCalls: unknown[][] = []
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: (...args: unknown[]) => {
        mockPointsCalls.push(args)
        return { pointsData: null }
    },
}))

jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false }),
}))

jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))

jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ isLoading: false, showWrapper: false, handleSelfHealResubmit: jest.fn() }),
}))

jest.mock('@/hooks/useWaitingOnProviderModal', () => ({
    useWaitingOnProviderModal: () => ({ open: jest.fn(), isOpen: false }),
}))

// the advisory pre-empt is pass-through here — its own behavior has its own
// tests. IMPORTANT: render-stable singletons, like the real hooks (their
// returns are useCallback-stable) — unstable mocks would recompute the old
// memoized submit handler and hide the frozen-closure regression.
const stableAdvisoryPreempt = { intercept: (fn: () => void) => fn(), modalProps: {} }
jest.mock('@/hooks/useAdvisoryPreempt', () => ({
    useAdvisoryPreempt: () => stableAdvisoryPreempt,
}))

const stableUpliftFunnel = { trackStarted: jest.fn(), trackCompleted: jest.fn(), reset: jest.fn() }
jest.mock('@/hooks/useEeaUpliftFunnel', () => ({
    useEeaUpliftFunnel: () => stableUpliftFunnel,
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { bridgeCustomerId: 'cust-1' } }, fetchUser: jest.fn() }),
}))

const mockCreateOfframp = jest.fn()
const mockConfirmOfframp = jest.fn()
jest.mock('@/app/actions/offramp', () => ({
    createOfframp: (...args: unknown[]) => mockCreateOfframp(...args),
    confirmOfframp: (...args: unknown[]) => mockConfirmOfframp(...args),
}))

// mutable gate + balance: the stale-closure regression flips these mid-test.
// gateFor is a fresh function each render, so the hook's gate memo recomputes.
let mockGateKind: string = 'ready'
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => ({ kind: mockGateKind, advisory: undefined }) }),
}))

const mockSendMoney = jest.fn()
let mockBalance: bigint | undefined = 100n * 10n ** 6n // 100 USDC
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: '0xuser', sendMoney: mockSendMoney, spendableBalance: mockBalance }),
}))

const mockSetError = jest.fn()
const bankAccount = { id: 'acct-1', bridgeAccountId: 'ext-1' }
// mutable: the context-loss recovery cases simulate a refresh that remounted
// the withdraw-scoped provider without a selected account
let mockBankAccount: typeof bankAccount | null = bankAccount
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({
        selectedBankAccount: mockBankAccount,
        error: { showError: false, errorMessage: '' },
        setError: mockSetError,
    }),
}))

import posthog from 'posthog-js'
import { useBridgeOfframpFlow } from '../useBridgeOfframpFlow'
import { useWithdrawAmount } from '../useWithdrawAmount'
import { SpendRecoveryAbortedError } from '@/hooks/wallet/signSpendRetry'

// ---------- helpers ----------

const renderFlow = (searchParams: Record<string, string>) =>
    renderHook(() => useBridgeOfframpFlow(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
        ),
    })

const armHappyOfframp = () => {
    mockCreateOfframp.mockResolvedValue({
        data: { depositInstructions: { toAddress: '0xdead' }, transferId: 'tr-1' },
    })
    mockSendMoney.mockResolvedValue({ receipt: null, userOpHash: undefined, txHash: '0xtx' })
    mockConfirmOfframp.mockResolvedValue({})
}

beforeEach(() => {
    jest.clearAllMocks()
    mockGateKind = 'ready'
    mockBalance = 100n * 10n ** 6n
    mockCountryId = 'US'
    mockOfframpConfig = { currency: 'usd', paymentRail: 'ach' }
    mockExchangeRate = '0.79'
    mockExchangeRateError = false
    mockExchangeRateCalls.length = 0
    mockPointsCalls.length = 0
    mockBankAccount = bankAccount
    mockIsBankFromSend = false
    mockQuote = null
    mockTxReverted = false
    mockQuoteReceivedAt = Date.now()
    mockDiscardedQuoteId = null
    mockQuoteError = false
    mockQuoteCalls.length = 0
})

// ---------- tests ----------

describe('useBridgeOfframpFlow — submit path (Chip review round 4)', () => {
    it('runs create → send → confirm with the normalized URL amount', async () => {
        armHappyOfframp()
        const view = renderFlow({ amount: '50', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '50' }))
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '50', { kind: 'FIAT_OFFRAMP' })
        expect(mockConfirmOfframp).toHaveBeenCalledWith('tr-1', '0xtx')
    })

    it('a click after the gate and balance resolve runs the offramp (regression: memoized handler froze the loading gate)', async () => {
        armHappyOfframp()
        mockGateKind = 'loading'
        mockBalance = undefined
        const view = renderFlow({ amount: '50', step: 'review' })

        // first render: capabilities + balance still loading — the click no-ops
        expect(view.result.current.isSubmitReady).toBe(false)
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()

        // capabilities + balance land; the SAME mounted hook must now proceed
        mockGateKind = 'ready'
        mockBalance = 100n * 10n ** 6n
        view.rerender()
        expect(view.result.current.isSubmitReady).toBe(true)

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '50' }))
        expect(mockConfirmOfframp).toHaveBeenCalledWith('tr-1', '0xtx')
    })

    it('a tampered over-balance ?amount= never reaches createOfframp or sendMoney', async () => {
        const view = renderFlow({ amount: '150', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'errors.notEnoughBalanceAddFunds',
        })
    })

    it('a below-minimum ?amount= never reaches createOfframp', async () => {
        const view = renderFlow({ amount: '0.5', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.minimumWithdrawal',
        })
    })

    it('a post-completion ?amount= edit cannot forge the success amount — executedAmountUsd stays pinned (Chip round 8)', async () => {
        armHappyOfframp()
        // probe hook alongside: the amount setter drives the SAME nuqs adapter
        const view = renderHook(() => ({ flow: useBridgeOfframpFlow(), amountState: useWithdrawAmount() }), {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <NuqsTestingAdapter searchParams={{ amount: '50', step: 'review' }}>{children}</NuqsTestingAdapter>
            ),
        })

        await act(async () => {
            view.result.current.flow.handleCreateAndInitiateOfframp()
        })
        expect(view.result.current.flow.executedAmountUsd).toBe('50')

        // tamper the URL after completion
        await act(async () => {
            await view.result.current.amountState[1]('5000')
        })
        expect(view.result.current.flow.amountToWithdraw).toBe('5000')
        // the success screen renders executedAmountUsd — still the moved amount
        expect(view.result.current.flow.executedAmountUsd).toBe('50')
        // the points estimate keys off the executed amount too — never the
        // edited URL (Chip round 9)
        expect(mockPointsCalls.at(-1)?.[1]).toBe('50')
    })

    // A GBP account; the minimum converts with the quote rate (0.79 GBP ≈ 1 USD →
    // £3 ≈ $4). A USD `?amount=` on it is quoted on its USDC side, so the quote
    // answers that amount (a Bridge-rate estimate: collection off).
    const useGbAccount = (usd: string) => {
        mockCountryId = 'GB' // real record: { id: 'GBR', iso2: 'GB' }
        mockOfframpConfig = { currency: 'gbp', paymentRail: 'faster_payments' }
        mockQuote = bridgeRateQuote({
            destinationCurrency: 'gbp',
            rate: '0.79',
            sourceAmount: usd,
            destinationAmount: (Number(usd) * 0.79).toFixed(2),
        })
    }

    it('GB: an amount below the converted £3 rail minimum never reaches createOfframp (Chip round 5)', async () => {
        useGbAccount('2')
        const view = renderFlow({ amount: '2', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.minimumWithdrawal',
        })
        // the £3 minimum converts through the GBP quote rate, the one rate of the
        // flow — not a second rate source, and not EUR on the 'GBR' id (Chip round 6)
        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'gbp', amount: { sourceAmount: '2' } })
        expect(mockExchangeRateCalls.every((c) => !c.enabled)).toBe(true)
    })

    it('GB: an amount above the converted minimum proceeds', async () => {
        armHappyOfframp()
        useGbAccount('5')
        const view = renderFlow({ amount: '5', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '5' }))
    })

    it.each([
        ['3.99', false],
        ['4', true],
    ])('GB at quote 0.79 (minimum $4): $%s proceeds = %s', async (amount, proceeds) => {
        armHappyOfframp()
        useGbAccount(amount)
        const view = renderFlow({ amount, step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        if (proceeds) expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount }))
        else expect(mockCreateOfframp).not.toHaveBeenCalled()
    })

    /*
     * The Bridge rate failed. It used to resolve as '1' and the flow demanded a
     * fabricated minimum; now there is no rate and nothing is submitted — and
     * the blocking notice says why.
     */
    it('GB: a quote whose refresh failed blocks the submit, says so with its retry, and never creates an offramp', async () => {
        armHappyOfframp()
        useGbAccount('50')
        // a USD amount, quoted on its USDC side; the quote's last refresh failed
        mockQuoteError = true
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(view.result.current.isSubmitReady).toBe(false)
        // the review's inline quote retry says the rate is unavailable, not a second notice
        expect(view.result.current.bankAmount?.quoteFailed).toBe(true)
        expect(view.result.current.balanceErrorMessage).toBeNull()
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('GB on a rail with no quote currency: the minimum uses the public withdrawal rate, and fails closed without it', () => {
        mockCountryId = 'GB' // rail stays usd: no quote for this account
        mockExchangeRate = null
        mockExchangeRateError = true
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: null })
        expect(mockExchangeRateCalls.some((c) => c.currency === 'GBP' && c.enabled)).toBe(true)
        expect(view.result.current.isSubmitReady).toBe(false)
        expect(view.result.current.balanceErrorMessage).toBe('exchangeRate.widget.rateUnavailable')
    })

    it('US: a fixed-floor destination needs no rate and is never blocked by one', () => {
        mockExchangeRate = null
        mockExchangeRateError = true
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(view.result.current.isSubmitReady).toBe(true)
        expect(view.result.current.balanceErrorMessage).toBeNull()
    })

    it('GB: while the FX rate behind the minimum loads, submit is not ready and the click no-ops', async () => {
        armHappyOfframp()
        useGbAccount('50')
        mockQuote = null
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(view.result.current.isSubmitReady).toBe(false)
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()
    })

    it('a malformed ?amount= never reaches createOfframp', async () => {
        const view = renderFlow({ amount: 'abc', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.invalidAmount',
        })
    })
})

// A refresh on the review page remounts the withdraw-scoped provider without
// the selected account. The URL is the sole durable amount store — the
// recovery redirect must carry ?amount= forward, or the user re-enters the
// amount they already typed (Chip round 10).
/**
 * The spend engine checks the card controller before it prepares or signs
 * anything, and that check can end the attempt: the user dismissed the
 * re-approval prompt, or left the screen. No funds moved and no deposit was
 * made, so the screen must not read as a failed withdrawal.
 */
describe('useBridgeOfframpFlow — card re-approval cancelled before the money leg', () => {
    it('confirms nothing, shows no error and reports no failure', async () => {
        mockCreateOfframp.mockResolvedValue({
            data: { depositInstructions: { toAddress: '0xdead' }, transferId: 'tr-1' },
        })
        mockSendMoney.mockRejectedValue(new SpendRecoveryAbortedError(new Error('grant dismissed')))
        const view = renderFlow({ amount: '50', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockConfirmOfframp).not.toHaveBeenCalled()
        expect(mockSetError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        expect(posthog.capture).not.toHaveBeenCalledWith('withdraw_failed', expect.anything())
    })

    it('a real send failure still surfaces and is reported — as an unknown outcome, never a Retry', async () => {
        mockCreateOfframp.mockResolvedValue({
            data: { depositInstructions: { toAddress: '0xdead' }, transferId: 'tr-1' },
        })
        mockSendMoney.mockRejectedValue(new Error('bundler 502'))
        const view = renderFlow({ amount: '50', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockSetError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        expect(posthog.capture).toHaveBeenCalledWith('withdraw_failed', expect.anything())
        // a USD withdrawal holds the same way: the deposit may have gone out
        expect(view.result.current.sendOutcomeUnknown).toBe(true)
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
    })
})

describe('useBridgeOfframpFlow — context-loss recovery preserves the URL amount (Chip round 10)', () => {
    it('review without a selected account: recovery to country selection carries ?amount=', () => {
        mockBankAccount = null
        renderFlow({ amount: '50', step: 'review' })

        expect(mockRouterReplace).toHaveBeenCalledWith('/withdraw/us?amount=50&step=form')
    })

    it('from the send flow, the method marker rides along with the amount', () => {
        mockBankAccount = null
        mockIsBankFromSend = true
        renderFlow({ amount: '50', step: 'review' })

        expect(mockRouterReplace).toHaveBeenCalledWith('/withdraw/us?method=bank&amount=50&step=form')
    })

    it('no amount at all: recovery to the flow entry keeps only the send marker', () => {
        mockIsBankFromSend = true
        renderFlow({ step: 'review' })

        expect(mockRouterReplace).toHaveBeenCalledWith('/withdraw?method=bank')
    })
})

describe('useBridgeOfframpFlow — the optional reference (TD-9)', () => {
    const submitWithReference = async (reference: string) => {
        armHappyOfframp()
        // a EUR, GBP, MXN or COP account is quoted for the USDC amount too; USD ignores it
        mockQuote = bridgeRateQuote({
            destinationCurrency: mockOfframpConfig.currency,
            sourceAmount: '50',
            destinationAmount: '44.77',
        })
        const view = renderFlow({ amount: '50', step: 'review' })
        act(() => view.result.current.setReference(reference))
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        return view
    }

    const sentDestination = () => mockCreateOfframp.mock.calls[0][0].destination as Record<string, unknown>

    it('SEPA: the reference goes out as sepaReference, trimmed', async () => {
        mockOfframpConfig = { currency: 'eur', paymentRail: 'sepa' }
        await submitWithReference('  Invoice 2026-09 / rent  ')

        expect(sentDestination()).toEqual({
            currency: 'eur',
            paymentRail: 'sepa',
            externalAccountId: 'ext-1',
            sepaReference: 'Invoice 2026-09 / rent',
        })
    })

    it('ACH: the reference goes out as achReference, and never as a SEPA or wire field', async () => {
        await submitWithReference('RENT SEP')

        expect(sentDestination()).toEqual({
            currency: 'usd',
            paymentRail: 'ach',
            externalAccountId: 'ext-1',
            achReference: 'RENT SEP',
        })
    })

    it('no reference: the request carries no reference field', async () => {
        mockOfframpConfig = { currency: 'eur', paymentRail: 'sepa' }
        await submitWithReference('   ')

        expect(sentDestination()).toEqual({ currency: 'eur', paymentRail: 'sepa', externalAccountId: 'ext-1' })
    })

    it.each([
        ['faster_payments', 'gbp', 'fasterPaymentsReference'],
        ['spei', 'mxn', 'speiReference'],
        ['co_bank_transfer', 'cop', 'coBankTransferReference'],
    ])('%s sends the reference in its own field, and in no other', async (paymentRail, currency, field) => {
        mockOfframpConfig = { currency, paymentRail }
        const view = await submitWithReference('Invoice 42')

        expect(view.result.current.referenceSpec?.field).toBe(field)
        expect(sentDestination()).toEqual({
            currency,
            paymentRail,
            externalAccountId: 'ext-1',
            [field]: 'Invoice 42',
        })
    })

    it('a rail that takes no reference offers no field and sends none', async () => {
        mockOfframpConfig = { currency: 'usd', paymentRail: 'wire' }
        const view = await submitWithReference('Invoice 42')

        expect(view.result.current.referenceSpec).toBeNull()
        expect(sentDestination()).toEqual({ currency: 'usd', paymentRail: 'wire', externalAccountId: 'ext-1' })
    })

    it('a reference that breaks the rail limits blocks the submit: nothing is created, nothing moves', async () => {
        // ACH takes 10 characters
        const view = await submitWithReference('Invoice 2026-09')

        expect(view.result.current.referenceProblem).toBe('invalidChars')
        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('SEPA: a reference under 6 characters blocks the submit', async () => {
        mockOfframpConfig = { currency: 'eur', paymentRail: 'sepa' }
        const view = await submitWithReference('rent')

        expect(view.result.current.referenceProblem).toBe('tooShort')
        expect(mockCreateOfframp).not.toHaveBeenCalled()
    })
})

describe('useBridgeOfframpFlow — bank amount typed in its currency (TASK-23054)', () => {
    beforeEach(() => {
        mockOfframpConfig = { currency: 'eur', paymentRail: 'sepa' }
        mockBalance = 3000n * 10n ** 6n
        mockQuote = bridgeRateQuote()
    })

    it('Bridge-rate quote (margin off): sends exactly the quoted USDC with no quoteId, as before', async () => {
        armHappyOfframp()
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(view.result.current.amountToWithdraw).toBe('2233.39')
        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', amount: { destinationAmount: '2000' } })
        // an estimate: the transfer converts at settlement
        expect(view.result.current.bankAmount?.isExact).toBe(false)

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).toHaveBeenCalledWith({
            amount: '2233.39',
            developer_fee: '0',
            onBehalfOf: 'cust-1',
            source: { currency: 'usdc', paymentRail: 'arbitrum', fromAddress: '0xuser' },
            destination: { currency: 'eur', paymentRail: 'sepa', externalAccountId: 'ext-1' },
        })
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '2233.39', { kind: 'FIAT_OFFRAMP' })
    })

    it('is not ready to submit until the quote arrives', async () => {
        mockQuote = null
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(view.result.current.isSubmitReady).toBe(false)
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()
    })

    it('a quote above the balance never reaches createOfframp', async () => {
        mockBalance = 2000n * 10n ** 6n
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'errors.notEnoughBalanceAddFunds',
        })
    })

    it('a US account ignores a bank amount: USD pays 1:1 and needs ?amount=', () => {
        mockOfframpConfig = { currency: 'usd', paymentRail: 'ach' }
        const view = renderFlow({ amount: '50', destinationAmount: '2000', step: 'review' })

        expect(view.result.current.bankAmount).toBeNull()
        expect(view.result.current.amountToWithdraw).toBe('50')
    })

    // A EUR account whose amount was entered in USD (Chip 5311936420): the amount
    // step hands on ?amount= alone. On this branch the review prices that USD
    // side (fees v2): the server quotes the payout for exactly USD 12.01, and the
    // floored EUR estimate of the amount step never comes back as an amount.
    it('a EUR account with a USD amount is quoted on its USD side: 12.01 sent, payout from the server', async () => {
        armHappyOfframp()
        // the signed quote for USD 12.01 at 0.8973 (Bridge 0.9 less 0.30%): €10.77, bank amount rounded down
        mockQuote = fixedOutputQuote({ sourceAmount: '12.01', destinationAmount: '10.77' })
        const view = renderFlow({ amount: '12.01', step: 'review' })

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', amount: { sourceAmount: '12.01' } })
        expect(mockQuoteCalls.some((call) => call.amount && 'destinationAmount' in call.amount)).toBe(false)
        expect(view.result.current.amountToWithdraw).toBe('12.01')
        // the payout the review shows is the server's, exact — not the 10.80 estimate at 0.9
        expect(view.result.current.bankAmount?.quote?.destinationAmount).toBe('10.77')
        expect(view.result.current.bankAmount?.isExact).toBe(true)

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        const payload = mockCreateOfframp.mock.calls[0][0]
        expect(payload).toMatchObject({ amount: '12.01', quoteId: 'quote-1' })
        expect(payload).not.toHaveProperty('destinationAmount')
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '12.01', { kind: 'FIAT_OFFRAMP' })
    })

    // A 503 on the 30-second refresh used to swap the page for the Retry screen,
    // unmounting an open KYC, terms or confirm step.
    it('a failed refresh keeps the quote on screen, but it is never confirmed', async () => {
        armHappyOfframp()
        mockQuoteError = true
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(view.result.current.bankAmount?.quote).toEqual(mockQuote)
        expect(view.result.current.bankAmount?.quoteFailed).toBe(true)
        expect(view.result.current.isSubmitReady).toBe(false)
        // the terms step calls the handler directly, past the disabled button
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it.each([
        ['90.', '90'],
        ['.5', '0.5'],
    ])('a mid-typing %s in the URL is quoted as %s, the form the API accepts', (typed, quoted) => {
        renderFlow({ destinationAmount: typed, step: 'review' })

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', amount: { destinationAmount: quoted } })
    })

    it('a bank amount the API refuses counts as no amount: back to the flow entry', () => {
        renderFlow({ destinationAmount: '12.345', step: 'review' })

        expect(mockRouterReplace).toHaveBeenCalledWith('/withdraw')
    })

    it('context loss keeps the bank amount in the recovery URL', () => {
        mockBankAccount = null
        renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining('destinationAmount=2000'))
    })
})

/**
 * Fees v2: a `fixed_output` quote carries Peanut's FX margin inside its rate,
 * and create must take its signed quoteId. The server rebuilds both amounts
 * from it; a refused quote (409 BRIDGE_QUOTE_*) makes no transfer, and the
 * app must show the new quote for the user to confirm — never fund or retry
 * a different amount on its own.
 */
describe('useBridgeOfframpFlow — fixed_output quote (fees v2)', () => {
    const EUR_DESTINATION = { currency: 'eur', paymentRail: 'sepa', externalAccountId: 'ext-1' }
    const SOURCE = { currency: 'usdc', paymentRail: 'arbitrum', fromAddress: '0xuser' }

    beforeEach(() => {
        mockOfframpConfig = { currency: 'eur', paymentRail: 'sepa' }
        mockBalance = 3000n * 10n ** 6n
        mockQuote = fixedOutputQuote()
    })

    const submit = async (view: ReturnType<typeof renderFlow>) => {
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
    }

    it('bank amount typed: create gets the quoteId and the quoted USDC, and that USDC is sent', async () => {
        armHappyOfframp()
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(view.result.current.amountToWithdraw).toBe('2240.11')
        expect(view.result.current.bankAmount?.isExact).toBe(true)
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledWith({
            amount: '2240.11',
            developer_fee: '0',
            onBehalfOf: 'cust-1',
            source: SOURCE,
            destination: EUR_DESTINATION,
            quoteId: 'quote-1',
        })
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '2240.11', { kind: 'FIAT_OFFRAMP' })
        expect(view.result.current.executedAmountUsd).toBe('2240.11')
    })

    it('USDC typed on a EUR account: quotes the USDC side and creates with that quote', async () => {
        armHappyOfframp()
        mockQuote = fixedOutputQuote({ sourceAmount: '50', destinationAmount: '44.64' })
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', amount: { sourceAmount: '50' } })
        expect(view.result.current.bankAmount?.quote?.destinationAmount).toBe('44.64')
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '50', quoteId: 'quote-1', destination: EUR_DESTINATION })
        )
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '50', { kind: 'FIAT_OFFRAMP' })
    })

    it('USDC with fractional cents is quoted at whole cents, never sent unquoted', async () => {
        armHappyOfframp()
        mockQuote = fixedOutputQuote({ sourceAmount: '50.12', destinationAmount: '44.74' })
        const view = renderFlow({ amount: '50.123456', step: 'review' })

        // the quote asks for the cut amount, and the review shows the quote's
        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', amount: { sourceAmount: '50.12' } })
        expect(view.result.current.amountToWithdraw).toBe('50.12')
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '50.12', quoteId: 'quote-1' }))
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '50.12', { kind: 'FIAT_OFFRAMP' })
    })

    it.each(['abc', '1.1234567', '0.009'])(
        'a EUR account with an amount the quote cannot take (%s) is refused, never sent unquoted',
        async (amount) => {
            armHappyOfframp()
            const view = renderFlow({ amount, step: 'review' })

            expect(mockQuoteCalls.every((call) => call.currency === null)).toBe(true)
            await submit(view)

            expect(mockCreateOfframp).not.toHaveBeenCalled()
            expect(mockSendMoney).not.toHaveBeenCalled()
            expect(mockSetError).toHaveBeenCalledWith({
                showError: true,
                errorMessage: 'withdraw.errors.invalidAmount',
            })
        }
    )

    it('USD account: no quote is asked for, and create gets no quoteId (USD↔USDC is exempt)', async () => {
        armHappyOfframp()
        mockOfframpConfig = { currency: 'usd', paymentRail: 'ach' }
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(mockQuoteCalls.every((call) => call.currency === null)).toBe(true)
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledWith({
            amount: '50',
            developer_fee: '0',
            onBehalfOf: 'cust-1',
            source: SOURCE,
            destination: { currency: 'usd', paymentRail: 'ach', externalAccountId: 'ext-1' },
        })
    })

    it.each([
        'BRIDGE_QUOTE_STALE',
        'BRIDGE_QUOTE_EXPIRED',
        'BRIDGE_QUOTE_MISMATCH',
        'BRIDGE_QUOTE_INVALID',
        'BRIDGE_QUOTE_USED',
    ])('%s: sends nothing, shows the new quote, and creates again only when the user confirms it', async (code) => {
        armHappyOfframp()
        mockCreateOfframp.mockResolvedValueOnce({ error: 'Get a new quote.', code, status: 409 })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSetError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        // the refused quote is gone: nothing to confirm until the new one lands
        expect(view.result.current.bankAmount?.quote).toBeNull()
        expect(view.result.current.isSubmitReady).toBe(false)
        expect(view.result.current.bankAmount?.quoteNotice).toBe('withdraw.reviewUpdatedQuote')

        // the new quote has other numbers; they are shown, and nothing runs on its own
        mockQuote = fixedOutputQuote({ quoteId: 'quote-2', sourceAmount: '2241.37', rate: '0.8923' })
        view.rerender()
        expect(view.result.current.amountToWithdraw).toBe('2241.37')
        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)

        await submit(view)
        expect(mockCreateOfframp).toHaveBeenCalledTimes(2)
        expect(mockCreateOfframp.mock.calls[1][0]).toMatchObject({ amount: '2241.37', quoteId: 'quote-2' })
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockSendMoney).toHaveBeenCalledWith('0xdead', '2241.37', { kind: 'FIAT_OFFRAMP' })
        expect(view.result.current.bankAmount?.quoteNotice).toBeNull()
    })

    it('a quote received over a minute ago is replaced before create', async () => {
        armHappyOfframp()
        mockQuoteReceivedAt = Date.now() - 61_000
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
        expect(view.result.current.bankAmount?.quoteNotice).toBe('withdraw.reviewUpdatedQuote')
    })

    it('the age limit is for fixed_output quotes only: an old Bridge-rate quote still creates', async () => {
        armHappyOfframp()
        mockQuote = bridgeRateQuote()
        mockQuoteReceivedAt = Date.now() - 61_000
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockQuoteDiscard).not.toHaveBeenCalled()
    })

    it('a retry for the same account may send the same quote again (the server replays that transfer)', async () => {
        armHappyOfframp()
        mockCreateOfframp.mockResolvedValueOnce({ error: 'Bridge is unavailable.', status: 502 })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)
        expect(mockSetError).toHaveBeenCalledWith({ showError: true, errorMessage: 'Bridge is unavailable.' })

        await submit(view)
        expect(mockCreateOfframp).toHaveBeenCalledTimes(2)
        expect(mockCreateOfframp.mock.calls[1][0]).toMatchObject({ quoteId: 'quote-1', destination: EUR_DESTINATION })
    })

    /** Held: no Retry, no new quote, no second create or send — only Activity to check. */
    const expectHeld = async (view: ReturnType<typeof renderFlow>) => {
        expect(view.result.current.sendOutcomeUnknown).toBe(true)
        expect(mockSetError).toHaveBeenLastCalledWith({
            showError: true,
            errorMessage: 'qrPay.errors.paymentStatusUnknown',
        })
        // the quote stops refreshing: no new numbers invite a second payment
        expect(mockQuoteCalls.at(-1)?.enabled).toBe(false)

        await submit(view)
        await submit(view)
        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockQuoteDiscard).not.toHaveBeenCalled()
    }

    it('sendMoney throws after a possible broadcast: held, never a second quote, transfer or send', async () => {
        armHappyOfframp()
        mockSendMoney.mockRejectedValueOnce(new Error('bundler 502'))
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockConfirmOfframp).not.toHaveBeenCalled()
        await expectHeld(view)
    })

    it('sendMoney returns no transaction id: held, confirm is never called', async () => {
        armHappyOfframp()
        mockSendMoney.mockResolvedValueOnce({ receipt: null, userOpHash: '0xop', txHash: undefined })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockConfirmOfframp).not.toHaveBeenCalled()
        await expectHeld(view)
    })

    it('the confirm call times out after the send: processing, and a second press never sends again', async () => {
        armHappyOfframp()
        mockConfirmOfframp.mockResolvedValueOnce({ error: 'The operation was aborted due to timeout' })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(view.result.current.submittedTxHash).toBe('0xtx')
        expect(mockSetError).toHaveBeenLastCalledWith({ showError: true, errorMessage: 'withdraw.bank.confirmPending' })
        await submit(view)
        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockSendMoney).toHaveBeenCalledTimes(1)
        expect(mockConfirmOfframp).toHaveBeenCalledTimes(1)
    })

    it('a mined revert proves nothing was paid: Retry is offered, with a new quote the user confirms', async () => {
        armHappyOfframp()
        mockTxReverted = true
        mockSendMoney.mockResolvedValueOnce({ receipt: { status: 'reverted' }, userOpHash: '0xop', txHash: '0xtx' })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })
        await submit(view)
        expect(view.result.current.sendOutcomeUnknown).toBe(false)
        expect(mockSetError).toHaveBeenLastCalledWith({
            showError: true,
            errorMessage: 'Transaction reverted by the network.',
        })

        // Retry: the reverted quote is not sent again
        mockTxReverted = false
        await submit(view)
        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
        expect(view.result.current.bankAmount?.quoteNotice).toBe('withdraw.reviewUpdatedQuote')

        // only the user's press on the new quote creates and sends again
        mockQuote = fixedOutputQuote({ quoteId: 'quote-2', sourceAmount: '2240.35' })
        view.rerender()
        await submit(view)
        expect(mockCreateOfframp).toHaveBeenLastCalledWith(
            expect.objectContaining({ quoteId: 'quote-2', amount: '2240.35' })
        )
        expect(mockSendMoney).toHaveBeenCalledTimes(2)
    })

    it('a dismissed passkey prompt signed nothing: Retry is offered, with a new quote', async () => {
        armHappyOfframp()
        const dismissed = new Error('The operation either timed out or was not allowed.')
        dismissed.name = 'NotAllowedError'
        mockSendMoney.mockRejectedValueOnce(dismissed)
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })
        await submit(view)

        expect(view.result.current.sendOutcomeUnknown).toBe(false)
        await submit(view)
        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
    })

    it('card re-approval dismissed before signing: the retry reuses the same quote (nothing was sent)', async () => {
        armHappyOfframp()
        mockSendMoney.mockRejectedValueOnce(new SpendRecoveryAbortedError(new Error('grant dismissed')))
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })
        await submit(view)

        await submit(view)

        expect(mockQuoteDiscard).not.toHaveBeenCalled()
        expect(mockCreateOfframp).toHaveBeenCalledTimes(2)
        expect(mockCreateOfframp.mock.calls[1][0]).toMatchObject({ quoteId: 'quote-1' })
        expect(mockSendMoney).toHaveBeenCalledTimes(2)
    })

    it('a quote already sent to create is not sent again for another reference', async () => {
        armHappyOfframp()
        mockCreateOfframp.mockResolvedValueOnce({ error: 'Bridge is unavailable.', status: 502 })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })
        await submit(view)

        act(() => view.result.current.setReference('Invoice 42'))
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
        expect(view.result.current.bankAmount?.quoteNotice).toBe('withdraw.reviewUpdatedQuote')
    })

    it('a quote already sent to create is not sent again for another account', async () => {
        armHappyOfframp()
        mockCreateOfframp.mockResolvedValueOnce({ error: 'Bridge is unavailable.', status: 502 })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })
        await submit(view)

        mockBankAccount = { id: 'acct-2', bridgeAccountId: 'ext-2' }
        view.rerender()
        await submit(view)

        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
        expect(mockQuoteDiscard).toHaveBeenCalledWith('quote-1')
    })

    it('a refused Bridge-rate create is an ordinary error: no quote to replace', async () => {
        armHappyOfframp()
        mockQuote = bridgeRateQuote()
        mockCreateOfframp.mockResolvedValueOnce({
            error: 'Get a new quote.',
            code: 'BRIDGE_QUOTE_INVALID',
            status: 409,
        })
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        await submit(view)

        expect(mockQuoteDiscard).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({ showError: true, errorMessage: 'Get a new quote.' })
    })
})

/**
 * The £3 rail floor under Peanut's margin. Bridge's gross GBP rate 0.75 makes
 * the USD minimum ceil(3 / 0.75) = $4; the net rate a signed quote pays,
 * 0.75 × 0.997 = 0.74775, makes it ceil(4.012) = $5. $4 at the net rate pays
 * £2.99 — under the floor the provider enforces.
 */
describe('useBridgeOfframpFlow — rail minimum under a signed quote (fees v2)', () => {
    const GBP_DESTINATION = { currency: 'gbp', paymentRail: 'faster_payments', externalAccountId: 'ext-1' }
    const signedGbpQuote = (overrides: Partial<MockQuote>) =>
        fixedOutputQuote({ destinationCurrency: 'gbp', rate: '0.74775', ...overrides })

    beforeEach(() => {
        armHappyOfframp()
        mockCountryId = 'GB'
        mockOfframpConfig = { currency: 'gbp', paymentRail: 'faster_payments' }
        mockExchangeRate = '0.75' // the gross rate: must not decide a signed quote's minimum
    })

    const submitWith = async (quote: MockQuote, destinationAmount: string) => {
        mockQuote = quote
        const view = renderFlow({ destinationAmount, step: 'review' })
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        return view
    }

    it('$4.00 paying £2.99 — what a gross-rate $4 minimum accepted — is refused', async () => {
        await submitWith(signedGbpQuote({ sourceAmount: '4.00', destinationAmount: '2.99' }), '2.99')

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.minimumWithdrawal',
        })
    })

    it('$4.99 is under the net-rate $5 minimum (the gross rate said $4)', async () => {
        await submitWith(signedGbpQuote({ sourceAmount: '4.99', destinationAmount: '3.73' }), '3.73')

        expect(mockCreateOfframp).not.toHaveBeenCalled()
    })

    it('exactly $5.00 at the net rate proceeds with its quote', async () => {
        await submitWith(signedGbpQuote({ sourceAmount: '5.00', destinationAmount: '3.73' }), '3.73')

        expect(mockCreateOfframp).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '5', quoteId: 'quote-1', destination: GBP_DESTINATION })
        )
    })

    it('the signed payout is checked too: £2.99 is refused even when its USD clears the minimum', async () => {
        // rate 0.8 → $4 minimum; a payout under £3 must not pass on the USD figure alone
        await submitWith(signedGbpQuote({ rate: '0.8', sourceAmount: '5.00', destinationAmount: '2.99' }), '2.99')

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.minimumWithdrawal',
        })
    })

    it('a payout of exactly £3.00 meets the floor', async () => {
        await submitWith(signedGbpQuote({ rate: '0.8', sourceAmount: '5.00', destinationAmount: '3.00' }), '3')

        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
    })

    it('chosen: a fresh signed quote carries its own rate, so a failed public-rate lookup does not block it', async () => {
        mockExchangeRate = null
        mockExchangeRateError = true
        const view = await submitWith(signedGbpQuote({ sourceAmount: '5.00', destinationAmount: '3.73' }), '3.73')

        expect(view.result.current.balanceErrorMessage).toBeNull()
        expect(mockCreateOfframp).toHaveBeenCalledTimes(1)
    })

    it('collection off (Bridge-rate quote): the minimum fails closed when the quote refresh failed', async () => {
        mockQuoteError = true
        const view = await submitWith(
            bridgeRateQuote({
                destinationCurrency: 'gbp',
                rate: '0.75',
                sourceAmount: '5.00',
                destinationAmount: '3.75',
            }),
            '3.75'
        )

        expect(view.result.current.isSubmitReady).toBe(false)
        expect(view.result.current.bankAmount?.quoteFailed).toBe(true)
        expect(mockCreateOfframp).not.toHaveBeenCalled()
    })

    it('collection off: the minimum converts at the Bridge-rate quote (Bridge’s own rate), no other rate read', async () => {
        await submitWith(
            bridgeRateQuote({
                destinationCurrency: 'gbp',
                rate: '0.75',
                sourceAmount: '4.00',
                destinationAmount: '3.00',
            }),
            '3'
        )

        // Bridge 0.75 → $4, as before fees v2; the bank amount stays an estimate
        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '4' }))
        expect(mockCreateOfframp.mock.calls[0][0]).not.toHaveProperty('quoteId')
        expect(mockExchangeRateCalls.every((call) => !call.enabled)).toBe(true)
    })
})
