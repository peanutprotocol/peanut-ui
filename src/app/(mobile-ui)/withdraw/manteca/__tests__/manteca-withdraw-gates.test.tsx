/**
 * Manteca withdraw — submit-time balance/limits gates (Chip review round 5).
 *
 * The page re-checks the async balance/limits gates at the two money
 * boundaries: before locking a price (handleBankDetailsSubmit) and right
 * before signing/submitting (handleWithdraw). A gate that flips to blocking
 * while the user sits on review must bounce back to the amount step WITHOUT
 * calling signSpend / mantecaApi.withdrawWithSignedTx; with all gates clear
 * the withdraw call fires once with the locked priceLockCode + usdAmount.
 *
 * Strategy (same as crypto-withdraw-confirm.test.tsx): mock every hook and
 * UI component at the module level, drive the real page component. The flow
 * reaches review through the REAL useMantecaAmountSeed (?amount= hand-off)
 * and the real price-lock handler (mantecaApi.initiateWithdraw mocked).
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { registerSpendArtifactMeta, SpendRecoveryQuoteReviewError } from '@/hooks/wallet/signSpendRetry'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants/manteca.consts'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'

// ---------- module-level mocks ----------

const mockRouterReplace = jest.fn()
const searchParamsMap: Record<string, string> = {
    country: 'argentina',
    destination: '0000003100010000000001',
}
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockRouterReplace, prefetch: jest.fn() }),
    useSearchParams: () => ({ get: (k: string) => searchParamsMap[k] ?? null }),
    usePathname: () => '/withdraw/manteca',
}))

jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
    useLocale: () => 'en',
}))

const mockPosthogCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockPosthogCapture(...args), init: jest.fn() },
}))

jest.mock('@sentry/nextjs', () => ({
    captureMessage: jest.fn(),
    captureException: jest.fn(),
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        WITHDRAW_CONFIRMED: 'withdraw_confirmed',
        WITHDRAW_COMPLETED: 'withdraw_completed',
        WITHDRAW_FAILED: 'withdraw_failed',
    },
}))

// ---------- UI component stubs ----------

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: { onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) => (
        <button onClick={props.onClick} disabled={props.disabled}>
            {props.children}
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/Card', () => ({
    Card: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/0_Bruddle/Callout', () => ({
    Callout: (props: { children?: React.ReactNode }) => <div role="alert">{props.children}</div>,
}))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({ LinkButton: () => null }))
jest.mock('@/components/0_Bruddle/BaseSelect', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))
jest.mock('@/components/Global/RateUnavailable/RateGateScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/ValidatedInput', () => ({
    __esModule: true,
    default: (props: {
        value: string
        onUpdate: (u: { value: string; isValid: boolean; isChanging: boolean }) => void
    }) => (
        <input
            data-testid="destination-input"
            value={props.value}
            onChange={(e) => props.onUpdate({ value: e.target.value, isValid: true, isChanging: false })}
        />
    ),
}))
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: ({ walletBalance, balanceFillAmount }: { walletBalance?: string; balanceFillAmount?: number }) => (
        <div data-testid="amount-input" data-wallet-balance={walletBalance} data-balance-fill={balanceFillAmount} />
    ),
}))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Common/PointsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/limits/components/LimitsWarningCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Global/Banner/MantecaTransfersMaintenanceView', () => ({
    MantecaTransfersMaintenanceView: () => <div data-testid="maintenance" />,
}))
jest.mock('@/features/withdraw/views/PixKeySendView', () => ({ __esModule: true, default: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { src: string; alt?: string }) => <img src={props.src} alt={props.alt ?? ''} />,
}))

// ---------- hook mocks ----------

let mockBalance: bigint | undefined = 100n * 10n ** 6n // 100 USDC
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        spendableBalance: mockBalance,
        formattedSpendableBalance: '$100.00',
        spendableBalanceDecimal: mockBalance === undefined ? undefined : Number(mockBalance) / 1e6,
    }),
}))

const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: mockSignSpend }),
}))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({
    useStaleSessionGuard: () => jest.fn(),
}))
// Stubbed to keep the heavy real module (balance query, viem client) out of
// this page test; it has to expose what the page tree actually calls.
jest.mock('@/hooks/wallet/spendPreflight', () => {
    class SessionKeyGrantRequiredError extends Error {
        constructor(readonly cause?: { kind?: string }) {
            super('Session-key grant required')
            this.name = 'SessionKeyGrantRequiredError'
        }
    }
    class RainControllerCheckError extends Error {}
    const WEBAUTHN_NAMES = ['NotAllowedError', 'NotReadableError', 'InvalidStateError', 'NotSupportedError']
    return {
        SessionKeyGrantRequiredError,
        RainControllerCheckError,
        isUserCancellation: (error: unknown) =>
            error instanceof SessionKeyGrantRequiredError
                ? error.cause?.kind === 'user-cancelled'
                : error instanceof Error && WEBAUTHN_NAMES.includes(error.name),
        sameAddress: (a: string | undefined, b: string | undefined) =>
            !!a && !!b && a.toLowerCase() === b.toLowerCase(),
    }
})
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: null }),
}))
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            isLoading: false,
            loadingState: 'Idle',
            setLoadingState: jest.fn(),
        }),
    }
})
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: [], nextActions: undefined }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: true }),
}))
jest.mock('@/utils/provider-rejection.utils', () => ({
    deriveProviderRejection: () => ({ state: 'none', userMessage: null }),
}))
const sumsubFlowStub = {
    isLoading: false,
    error: null,
    showWrapper: false,
    accessToken: null,
    handleRestartIdentity: jest.fn(),
    handleFixableRejection: jest.fn(),
    handleInitiateKyc: jest.fn(),
    handleSelfHealResubmit: jest.fn(),
    handleClose: jest.fn(),
    handleSdkComplete: jest.fn(),
    refreshToken: jest.fn(),
}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => sumsubFlowStub,
}))
jest.mock('@/hooks/useSumsubActionFlow', () => ({
    useSumsubActionFlow: () => ({
        showWrapper: false,
        accessToken: null,
        isLoading: false,
        handleInitiate: jest.fn(),
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
    }),
}))
jest.mock('@/app/actions/increase-limits', () => ({
    initiateIncreaseLimits: jest.fn(),
}))
jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({ hasPendingTransactions: false }),
}))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: () => {} }))
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: null, pointsDivRef: { current: null } }),
}))
// mutable limits verdict — the gate under test
const mockLimitsValidation = {
    isBlocking: false,
    isLoading: false,
    isWarning: false,
    message: null as string | null,
    remainingLimit: null,
    totalLimit: null,
    daysUntilReset: null,
    currency: 'ARS',
    limitCurrency: null,
}
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => mockLimitsValidation,
}))
jest.mock('@/features/limits/utils', () => ({
    getLimitsWarningCardProps: () => null,
    isBrUserEligibleForLimitIncrease: () => false,
}))
jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({ mantecaLimits: null, refetch: jest.fn() }),
}))
jest.mock('@/utils/regions.utils', () => ({
    ...jest.requireActual('@/utils/regions.utils'),
    isVerifiedForCountry: () => true,
}))
jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({
        code: 'ARS',
        price: { sell: 1500, buy: 1490 },
        isLoading: false,
        refetch: jest.fn(),
    }),
}))
const mockInitiateWithdraw = jest.fn()
const mockWithdrawWithSignedTx = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: {
        initiateWithdraw: (...args: unknown[]) => mockInitiateWithdraw(...args),
        withdrawWithSignedTx: (...args: unknown[]) => mockWithdrawWithSignedTx(...args),
    },
}))
jest.mock('@/utils/friendly-error.utils', () => ({
    friendlyError: () => ({ kind: 'text' }),
}))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: jest.fn(),
    isNetworkLayerFailure: () => false,
}))
jest.mock('@/utils/sentry-critical-flow', () => ({
    criticalFlowTags: () => ({}),
}))
jest.mock('@/utils/native-routes', () => ({
    withdrawCountryUrl: (country: string) => `/withdraw/${country}`,
}))
// the no-history Back fallback each render asks for
const mockSafeBackFallbacks: string[] = []
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: (fallbackUrl: string) => {
        mockSafeBackFallbacks.push(fallbackUrl)
        return jest.fn()
    },
    useReturnTo: () => jest.fn(),
}))
jest.mock('@/constants/countryCurrencyMapping', () => ({
    getFlagUrl: () => '/flag.png',
}))
jest.mock('@/utils/country-name.utils', () => ({
    localizedCountryTitle: () => 'Argentina',
}))
jest.mock('@/i18n/app/loading-states', () => ({
    loadingStateKey: (s: string) => s,
}))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// Only what the controller-recovery path reads: the cache repair and the
// controller comparison that authorises a replacement.
const mockRefreshControllerAddress = jest.fn()
jest.mock('@/services/rain', () => ({
    rainApi: {
        refreshControllerAddress: (...args: unknown[]) => mockRefreshControllerAddress(...args),
        cancelPreparation: jest.fn(),
    },
    RainCooldownError: class RainCooldownError extends Error {
        readonly retryAfterSec: number | null
        constructor(message: string, retryAfterSec: number | null) {
            super(message)
            this.name = 'RainCooldownError'
            this.retryAfterSec = retryAfterSec
        }
    },
    RAIN_STALE_APPROVAL_EVENT: 'rain:stale-card-approval',
}))

// URL stepper: mutable step, like crypto-withdraw-confirm.test.tsx
const mockStepperGoTo = jest.fn()
const mockStepper = {
    step: 'amount' as string,
    goTo: mockStepperGoTo,
    back: jest.fn(),
    reset: jest.fn(),
    isFirst: false,
}
jest.mock('@/hooks/useFlowStepper', () => ({
    useFlowStepper: () => mockStepper,
}))

let mockUrlAmount = '50'
jest.mock('@/features/withdraw/useWithdrawAmount', () => ({
    useWithdrawAmount: () => [mockUrlAmount, jest.fn()],
}))

import MantecaWithdrawFlow from '../page'

// ---------- helpers ----------

const PRICE_LOCK = { priceLockCode: 'lock-1', fiatAmount: '75000.00' }

const render = (ui: React.ReactElement) => rtlRender(ui)

/** Destination confirmation precedes amount entry and the price lock. */
const reachReview = async (lock: Record<string, unknown> = PRICE_LOCK) => {
    mockInitiateWithdraw.mockResolvedValue({ data: lock })
    mockStepper.step = 'bank-details'
    const view = render(<MantecaWithdrawFlow />)
    fireEvent.change(screen.getByTestId('destination-input'), { target: { value: '0000003100010000000009' } })
    fireEvent.click(screen.getByText('common.continue'))
    expect(mockInitiateWithdraw).not.toHaveBeenCalled()
    expect(mockStepperGoTo).toHaveBeenCalledWith('amount')
    mockStepper.step = 'amount'
    view.rerender(<MantecaWithdrawFlow />)
    fireEvent.click(screen.getByText('common.continue'))
    // the price locked and the flow asked for review
    await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledWith({ amount: '50.00', currency: 'ARS' }))
    await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('review'))

    mockStepper.step = 'review'
    view.rerender(<MantecaWithdrawFlow />)
    return view
}

const clickConfirm = () => fireEvent.click(screen.getByText('navigation.withdraw'))

beforeEach(() => {
    jest.clearAllMocks()
    mockBalance = 100n * 10n ** 6n
    mockUrlAmount = '50'
    mockStepper.step = 'amount'
    Object.assign(mockLimitsValidation, { isBlocking: false, isLoading: false })
})

// ---------- tests ----------

// Back with no in-app history landed on /withdraw?showAll=true, the full method
// list, and skipped the saved destinations. /withdraw shows them when there are any.
describe('manteca withdraw — Back without history', () => {
    it('falls back to the withdraw entry, not the full method list', () => {
        mockStepper.step = 'bank-details'
        render(<MantecaWithdrawFlow />)

        expect(mockSafeBackFallbacks.at(-1)).toBe('/withdraw')
    })
})

describe('manteca withdraw — submit-time gates (Chip review round 5)', () => {
    it('all gates clear: the withdraw fires once with the locked price and amount', async () => {
        mockSignSpend.mockResolvedValue({
            strategy: 'smart-only',
            signedUserOp: { signedUserOp: '0xsigned', chainId: '42161', entryPointAddress: '0xep' },
        })
        mockWithdrawWithSignedTx.mockResolvedValue({ data: { ok: true } })

        await reachReview()
        clickConfirm()

        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1))
        expect(mockWithdrawWithSignedTx).toHaveBeenCalledWith(
            expect.objectContaining({ priceLockCode: 'lock-1', amount: '50.00' })
        )
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
    })

    it('limits flip to blocking on review: Confirm bounces to the amount step and moves no money', async () => {
        const view = await reachReview()

        // the async limits verdict flips while the user sits on review
        mockLimitsValidation.isBlocking = true
        view.rerender(<MantecaWithdrawFlow />)
        mockStepperGoTo.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('amount'))
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()
    })

    it('balance becomes undefined on review (refetch gap): Confirm bounces and moves no money', async () => {
        const view = await reachReview()

        mockBalance = undefined
        view.rerender(<MantecaWithdrawFlow />)
        mockStepperGoTo.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('amount'))
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()
    })

    it('balance drops below the amount on review: Confirm bounces synchronously and moves no money', async () => {
        const view = await reachReview()

        // the live balance drops under the $50 amount while the user sits on
        // review — the gate must ask the LIVE balance, not the effect-lagged
        // message state (Chip round 6)
        mockBalance = 10n * 10n ** 6n
        view.rerender(<MantecaWithdrawFlow />)
        mockStepperGoTo.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('amount'))
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()
    })

    /*
     * The offramp twin of the QR replacement case: the backend's definitive
     * no-effect rejection created no Manteca order, so the SAME payment is
     * re-signed and re-submitted under the SAME price lock — same money, same
     * bank destination — with only the preparation/artifact fresh. No quote is
     * re-minted and the user is asked for nothing.
     */
    it('a definitive no-effect rejection replays once under the SAME price lock with a fresh artifact', async () => {
        const OLD_COORD = `0x${'a'.repeat(40)}`
        const NEW_COORD = `0x${'b'.repeat(40)}`
        const mixedArtifact = (prep: string, coordinatorAddress: string) =>
            registerSpendArtifactMeta(
                {
                    strategy: 'mixed' as const,
                    rainPreparationId: prep,
                    signedUserOp: { signedUserOp: '0xsigned', chainId: '42161', entryPointAddress: '0xep' },
                },
                { coordinatorAddress, mixedSpendContract: 'broadcast-first-revert-v1' }
            )
        mockSignSpend
            .mockResolvedValueOnce(mixedArtifact('prep-1', OLD_COORD))
            .mockResolvedValueOnce(mixedArtifact('prep-2', NEW_COORD))
        mockRefreshControllerAddress.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockWithdrawWithSignedTx
            .mockResolvedValueOnce({ error: 'Failed to broadcast UserOp', code: 'USER_OP_REVERTED' })
            .mockResolvedValueOnce({ transactionHash: '0xhash' })

        await reachReview()
        mockInitiateWithdraw.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(2))
        const firstBody = mockWithdrawWithSignedTx.mock.calls[0][0]
        const secondBody = mockWithdrawWithSignedTx.mock.calls[1][0]
        expect(firstBody).toMatchObject({
            priceLockCode: 'lock-1',
            amount: '50.00',
            destinationAddress: '0000003100010000000009',
            currency: 'ARS',
        })
        // Same quote and same payout instruction on both submissions.
        expect(secondBody.priceLockCode).toBe(firstBody.priceLockCode)
        expect(secondBody.amount).toBe(firstBody.amount)
        expect(secondBody.destinationAddress).toBe(firstBody.destinationAddress)
        expect(firstBody.bankCode).toBeUndefined()
        expect(secondBody.bankCode).toBeUndefined()
        expect(firstBody.accountType).toBeUndefined()
        expect(secondBody.accountType).toBeUndefined()
        expect(secondBody.currency).toBe(firstBody.currency)
        // Fresh replacement artifact.
        expect(firstBody.rainPreparationId).toBe('prep-1')
        expect(secondBody.rainPreparationId).toBe('prep-2')
        // Re-signed for the same money and recipient — and no new quote.
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
        expect(mockSignSpend.mock.calls[0][0]).toMatchObject({
            requiredUsdcAmount: 50_000_000n,
            recipient: MANTECA_DEPOSIT_ADDRESS,
            kind: 'FIAT_OFFRAMP',
        })
        expect(mockSignSpend.mock.calls[1][0].requiredUsdcAmount).toBe(
            mockSignSpend.mock.calls[0][0].requiredUsdcAmount
        )
        expect(mockSignSpend.mock.calls[1][0].recipient).toBe(mockSignSpend.mock.calls[0][0].recipient)
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('failure')
    }, 20_000)

    /*
     * Controller-rotation quote handoff: nothing was ordered or broadcast, so
     * the SAME payment stays on review — Rain's cooldown is waited out first,
     * then the quote is re-locked for the SAME USD amount and the user must
     * confirm again. No submission happens under terms they did not see.
     */
    it('a quote-review handoff waits, re-locks the same amount, and cannot be re-entered meanwhile', async () => {
        jest.useFakeTimers({ advanceTimers: true })
        mockSignSpend.mockRejectedValueOnce(new SpendRecoveryQuoteReviewError(new Error('cooling down'), 2))
        await reachReview()
        mockInitiateWithdraw.mockClear()
        // reachReview itself passes through the amount step (destination first).
        mockStepperGoTo.mockClear()

        clickConfirm()
        await waitFor(() => expect(mockSignSpend).toHaveBeenCalledTimes(1))

        // Inside the cooldown: no new quote yet, and a second tap re-enters
        // nothing — no signature, no submission.
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
        clickConfirm()
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_100)
        })
        // Re-locked for the SAME USD amount; the review step never bounced.
        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledWith({ amount: '50.00', currency: 'ARS' }))
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('amount')
        jest.useRealTimers()
    }, 20_000)

    it('a failed re-lock leaves review usable: the next tap re-quotes only, the one after pays', async () => {
        mockSignSpend.mockRejectedValueOnce(new SpendRecoveryQuoteReviewError(new Error('cooling down')))
        mockSignSpend.mockResolvedValue({
            strategy: 'smart-only',
            signedUserOp: { signedUserOp: '0xsigned', chainId: '42161', entryPointAddress: '0xep' },
        })
        await reachReview()
        mockInitiateWithdraw.mockClear()
        mockInitiateWithdraw.mockResolvedValueOnce({ error: 'provider down' })

        // Tap 1: the handoff re-quotes, and the re-quote fails.
        clickConfirm()
        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()

        // Tap 2: quote ONLY — never a signature against the dead lock.
        mockInitiateWithdraw.mockResolvedValueOnce({ data: { priceLockCode: 'lock-2', fiatAmount: '76000.00' } })
        clickConfirm()
        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(2))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()

        // Tap 3 confirms the fresh terms and pays under the NEW lock.
        clickConfirm()
        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1))
        expect(mockWithdrawWithSignedTx).toHaveBeenCalledWith(
            expect.objectContaining({ priceLockCode: 'lock-2', amount: '50.00' })
        )
    }, 20_000)

    it('an expired quote never signs: it re-locks and waits for a new confirmation', async () => {
        // the API measured no time left on the lock
        await reachReview({ ...PRICE_LOCK, expiresInMs: 0 })
        mockInitiateWithdraw.mockClear()

        clickConfirm()

        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockWithdrawWithSignedTx).not.toHaveBeenCalled()
    }, 20_000)

    // A phone clock a few minutes fast read Manteca's expiresAt as already past
    // and re-quoted on every attempt. The lock's remaining time decides.
    it('a fast device clock does not expire a live quote: it signs', async () => {
        await reachReview({
            ...PRICE_LOCK,
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            expiresInMs: 120_000,
        })
        mockInitiateWithdraw.mockClear()

        clickConfirm()

        await waitFor(() => expect(mockSignSpend).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
    }, 20_000)

    it('does not lock a price while limits are loading', async () => {
        mockStepper.step = 'bank-details'
        const view = render(<MantecaWithdrawFlow />)
        fireEvent.change(screen.getByTestId('destination-input'), { target: { value: '0000003100010000000009' } })
        fireEvent.click(screen.getByText('common.continue'))
        mockStepper.step = 'amount'
        mockLimitsValidation.isLoading = true
        view.rerender(<MantecaWithdrawFlow />)
        expect(screen.getByText('common.continue')).toBeDisabled()
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
    })
})

/**
 * Collateral that covers the withdrawal signs DIRECTLY: the artifact goes to the
 * backend as `kind: 'rainWithdrawal'`. Recovery is the real shared engine; a
 * direct artifact only ever replays after the backend's proven pre-effect
 * RAIN_CONTROLLER_CHANGED — pending, unknown and structured late failures are
 * submitted once and never re-signed.
 */
describe('manteca withdraw — direct collateral artifact', () => {
    const OLD_COORD = `0x${'a'.repeat(40)}`
    const NEW_COORD = `0x${'b'.repeat(40)}`
    // The provider's entity-aware deposit address: the SPEND recipient, never
    // the bank destination typed by the user.
    const PROVIDER_ADDRESS = '0x6E945f8EC93061f5f11Edc5e6Fb4A70BeB514e97'
    const BANK_DESTINATION = '0000003100010000000009'
    const LOCK = { ...PRICE_LOCK, depositAddress: PROVIDER_ADDRESS }

    const directArtifact = (prep: string, coordinatorAddress: string) =>
        registerSpendArtifactMeta(
            {
                strategy: 'collateral-only' as const,
                rainWithdrawal: {
                    preparedCoordinatorAddress: coordinatorAddress,
                    preparationId: prep,
                    amount: '50000000',
                    recipientAddress: PROVIDER_ADDRESS as `0x${string}`,
                    directTransfer: true,
                    adminSalt: `0x${'11'.repeat(32)}`,
                    adminNonce: '1',
                    adminSignature: `0x${'ab'.repeat(65)}`,
                    executorSignature: '0x44',
                    executorSalt: `0x${'22'.repeat(32)}`,
                    expiresAt: 1234567890,
                },
            },
            { coordinatorAddress }
        )

    it('signs once and submits the direct artifact with the provider recipient apart from the bank destination', async () => {
        const artifact = directArtifact('prep-1', OLD_COORD)
        mockSignSpend.mockResolvedValue(artifact)
        mockWithdrawWithSignedTx.mockResolvedValue({ transactionHash: '0xhash' })

        await reachReview(LOCK)
        clickConfirm()

        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockSignSpend.mock.calls[0][0]).toMatchObject({
            requiredUsdcAmount: 50_000_000n,
            recipient: PROVIDER_ADDRESS,
            kind: 'FIAT_OFFRAMP',
        })
        const body = mockWithdrawWithSignedTx.mock.calls[0][0]
        expect(body).toEqual({
            kind: 'rainWithdrawal',
            priceLockCode: 'lock-1',
            amount: '50.00',
            destinationAddress: BANK_DESTINATION,
            bankCode: undefined,
            accountType: undefined,
            currency: 'ARS',
            signedRainWithdrawal: (artifact as { rainWithdrawal: unknown }).rainWithdrawal,
            chainId: '42161',
        })
        expect(body.destinationAddress).not.toBe(PROVIDER_ADDRESS)
        expect(mockStepperGoTo).toHaveBeenCalledWith('success')
    })

    it.each([
        ['an unknown network failure', () => Promise.reject(new Error('Network request timed out'))],
        [
            'a WITHDRAWAL_PENDING_CONFIRMATION conflict',
            () =>
                Promise.reject(
                    new ApiError('Withdrawal pending confirmation', {
                        status: 409,
                        code: 'WITHDRAWAL_PENDING_CONFIRMATION',
                    })
                ),
        ],
        [
            'a structured revert even with a moved controller',
            () => Promise.resolve({ error: 'Failed to broadcast UserOp', code: 'USER_OP_REVERTED' }),
        ],
        ['a still-pending response', () => Promise.resolve({ status: 'PENDING' })],
    ])('%s: submitted once, never re-signed', async (_label, outcome) => {
        mockSignSpend.mockResolvedValue(directArtifact('prep-1', OLD_COORD))
        mockRefreshControllerAddress.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockWithdrawWithSignedTx.mockImplementation(outcome)

        await reachReview(LOCK)
        mockInitiateWithdraw.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1))
        // Let any (wrongly) triggered recovery run before asserting it did not.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
        })
        expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
    })

    it('a proven pre-effect RAIN_CONTROLLER_CHANGED re-signs once under the SAME lock and amount', async () => {
        mockSignSpend
            .mockResolvedValueOnce(directArtifact('prep-1', OLD_COORD))
            .mockResolvedValueOnce(directArtifact('prep-2', NEW_COORD))
        mockWithdrawWithSignedTx
            .mockRejectedValueOnce(
                new ApiError('Rain controller changed', {
                    status: 409,
                    code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED,
                })
            )
            .mockResolvedValueOnce({ transactionHash: '0xhash' })

        await reachReview(LOCK)
        mockInitiateWithdraw.mockClear()
        clickConfirm()

        await waitFor(() => expect(mockWithdrawWithSignedTx).toHaveBeenCalledTimes(2))
        const [first, second] = mockWithdrawWithSignedTx.mock.calls.map(([body]) => body)
        expect(first.signedRainWithdrawal.preparationId).toBe('prep-1')
        expect(second).toMatchObject({
            kind: 'rainWithdrawal',
            priceLockCode: 'lock-1',
            amount: '50.00',
            destinationAddress: BANK_DESTINATION,
            currency: 'ARS',
        })
        expect(second.signedRainWithdrawal.preparationId).toBe('prep-2')
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
        expect(mockSignSpend.mock.calls[1][0]).toMatchObject({
            requiredUsdcAmount: 50_000_000n,
            recipient: PROVIDER_ADDRESS,
            kind: 'FIAT_OFFRAMP',
        })
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
        expect(mockStepperGoTo).not.toHaveBeenCalledWith('failure')
    }, 20_000)
})

// TASK-22452: the amount field is in the local currency while the balance row is
// in USD, so the fill has to cross the same rate the screen quotes — a raw USD
// number here would offer ~1/1500th of the balance.
describe('manteca withdraw — balance fill crosses the quoted rate', () => {
    it('offers the spendable balance converted at currencyPrice.sell', () => {
        mockStepper.step = 'amount'
        render(<MantecaWithdrawFlow />)

        // 100 USDC spendable x 1500 ARS/USD = 150000 ARS
        expect(screen.getByTestId('amount-input')).toHaveAttribute('data-balance-fill', '150000')
    })

    it('offers nothing while the balance is still loading', () => {
        mockBalance = undefined
        mockStepper.step = 'amount'
        render(<MantecaWithdrawFlow />)

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-balance-fill')
    })
})
