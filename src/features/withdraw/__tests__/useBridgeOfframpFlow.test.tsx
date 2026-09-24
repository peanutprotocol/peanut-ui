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

jest.mock('@/utils/general.utils', () => ({
    isTxReverted: () => false,
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

// Bridge sell rate: the shared minimum's source when the account has no quote
// currency. An account with one converts the minimum with its quote instead.
let mockExchangeRate: string | null | undefined = '0.79'
let mockExchangeRateError = false
const mockExchangeRateCalls: Array<{ accountType: unknown; enabled?: boolean }> = []
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: (args: { accountType: unknown; enabled?: boolean }) => {
        mockExchangeRateCalls.push(args)
        return { exchangeRate: mockExchangeRate, isFetchingRate: false, isError: mockExchangeRateError }
    },
}))

// bank amount typed in its currency (TASK-23054): the quote the review shows and
// funds. Its rate (local currency per 1 USD) also converts the rail minimum.
let mockQuote: { rate: string; sourceAmount?: string } | null = null
// the last refresh failed: the quote stays, but is no longer current
let mockQuoteError = false
const mockQuoteRefetch = jest.fn()
const mockQuoteCalls: Array<{ currency: string | null; destinationAmount?: string; enabled?: boolean }> = []
jest.mock('@/hooks/useBridgeOfframpQuote', () => ({
    useBridgeOfframpQuote: (args: { currency: string | null; destinationAmount?: string; enabled?: boolean }) => {
        mockQuoteCalls.push(args)
        return {
            quote: args.currency ? mockQuote : null,
            isFetching: false,
            isError: !!args.currency && mockQuoteError,
            refetch: mockQuoteRefetch,
        }
    },
}))

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

    // a GBP account; the minimum converts with the quote rate (0.79 GBP ≈ 1 USD → £3 ≈ $4)
    const useGbAccount = () => {
        mockCountryId = 'GB' // real record: { id: 'GBR', iso2: 'GB' }
        mockOfframpConfig = { currency: 'gbp', paymentRail: 'faster_payments' }
        mockQuote = { rate: '0.79' }
    }

    it('GB: an amount below the converted £3 rail minimum never reaches createOfframp (Chip round 5)', async () => {
        useGbAccount()
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
        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'gbp', destinationAmount: undefined })
    })

    it('GB: an amount above the converted minimum proceeds', async () => {
        armHappyOfframp()
        useGbAccount()
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
        useGbAccount()
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
    it('GB: a failed rate quote blocks the submit, says the rate is unavailable, and never creates an offramp', async () => {
        armHappyOfframp()
        useGbAccount()
        // a USD amount: the quote is fetched for the rate alone, and its refresh failed
        mockQuoteError = true
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(view.result.current.isSubmitReady).toBe(false)
        expect(view.result.current.balanceErrorMessage).toBe('exchangeRate.widget.rateUnavailable')
        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })
        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSendMoney).not.toHaveBeenCalled()
    })

    it('GB on a rail with no quote currency: the minimum uses the Bridge sell rate, and fails closed without it', () => {
        mockCountryId = 'GB' // rail stays usd: no quote for this account
        mockExchangeRate = null
        mockExchangeRateError = true
        const view = renderFlow({ amount: '50', step: 'review' })

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: null })
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
        useGbAccount()
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

    it('a real send failure still surfaces and is reported', async () => {
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
        mockQuote = { rate: '0.8955', sourceAmount: '2233.39' }
    })

    it('sends exactly the quoted USDC, source-denominated as before', async () => {
        armHappyOfframp()
        const view = renderFlow({ destinationAmount: '2000', step: 'review' })

        expect(view.result.current.amountToWithdraw).toBe('2233.39')
        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', destinationAmount: '2000' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        const payload = mockCreateOfframp.mock.calls[0][0]
        expect(payload.amount).toBe('2233.39')
        // the bank amount never reaches the offramp: the transfer converts the USDC
        expect(payload).not.toHaveProperty('destinationAmount')
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

        expect(mockQuoteCalls.at(-1)).toMatchObject({ currency: 'eur', destinationAmount: quoted })
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
