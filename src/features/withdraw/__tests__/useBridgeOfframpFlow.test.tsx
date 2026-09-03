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

jest.mock('next/navigation', () => ({
    useParams: () => ({ country: 'us' }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
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
jest.mock('@/utils/bridge.utils', () => ({
    getOfframpConfigFromAccount: () => ({ currency: 'usd', paymentRail: 'ach' }),
    getCountryFromPath: () =>
        mockCountryId === 'GB'
            ? { id: 'GBR', iso2: 'GB', title: 'United Kingdom' }
            : { id: 'US', iso2: 'US', title: 'United States' },
    railJurisdictionForBank: () => 'US',
    // mirrors the real per-country local-currency minimums ($1 / £3 / 50 MXN)
    getMinimumAmount: (id: string) => (id === 'MX' ? 50 : id === 'GB' || id === 'GBR' ? 3 : 1),
}))

// sell rate: local currency per 1 USD (0.79 GBP ≈ 1 USD → £3 ≈ $4)
let mockExchangeRate: string | undefined = '0.79'
const mockExchangeRateCalls: Array<{ accountType: unknown; enabled?: boolean }> = []
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: (args: { accountType: unknown; enabled?: boolean }) => {
        mockExchangeRateCalls.push(args)
        return { exchangeRate: mockExchangeRate, isFetchingRate: false }
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

jest.mock('@/hooks/useSendFlowOrigin', () => ({
    useSendFlowOrigin: () => ({ isBankFromSend: false }),
}))

jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: null }),
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
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({
        selectedBankAccount: bankAccount,
        error: { showError: false, errorMessage: '' },
        setError: mockSetError,
    }),
}))

import { useBridgeOfframpFlow } from '../useBridgeOfframpFlow'
import { useWithdrawAmount } from '../useWithdrawAmount'
import { AccountType } from '@/interfaces/interfaces'

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
    mockExchangeRate = '0.79'
    mockExchangeRateCalls.length = 0
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
    })

    it('GB: an amount below the converted £3 rail minimum never reaches createOfframp (Chip round 5)', async () => {
        mockCountryId = 'GB' // real record: { id: 'GBR', iso2: 'GB' }; £3 ÷ 0.79 → $4 minimum
        const view = renderFlow({ amount: '2', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).not.toHaveBeenCalled()
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'withdraw.errors.minimumWithdrawal',
        })
        // the £3 minimum must convert through the GBP rate, not fall through
        // to IBAN/EUR on the 'GBR' id (Chip round 6)
        expect(mockExchangeRateCalls.some((c) => c.accountType === AccountType.GB && c.enabled)).toBe(true)
    })

    it('GB: an amount above the converted minimum proceeds', async () => {
        armHappyOfframp()
        mockCountryId = 'GB'
        const view = renderFlow({ amount: '5', step: 'review' })

        await act(async () => {
            view.result.current.handleCreateAndInitiateOfframp()
        })

        expect(mockCreateOfframp).toHaveBeenCalledWith(expect.objectContaining({ amount: '5' }))
    })

    it('GB: while the FX rate behind the minimum loads, submit is not ready and the click no-ops', async () => {
        armHappyOfframp()
        mockCountryId = 'GB'
        mockExchangeRate = undefined
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
