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
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'

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
jest.mock('@/components/0_Bruddle/Notification', () => ({
    Notification: (props: { children?: React.ReactNode }) => <div role="alert">{props.children}</div>,
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
    default: () => <div data-testid="amount-input" />,
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
    useWallet: () => ({ spendableBalance: mockBalance, formattedSpendableBalance: '$100.00' }),
}))

const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: mockSignSpend }),
}))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({
    useStaleSessionGuard: () => jest.fn(),
}))
jest.mock('@/hooks/wallet/spendPreflight', () => ({
    SessionKeyGrantRequiredError: class SessionKeyGrantRequiredError extends Error {},
}))
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
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
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

/**
 * Drive the real flow to the review step: the seed consumes ?amount=50 on the
 * amount step (advancing via the mocked stepper), bank-details submits with
 * the ?destination=-prefilled CBU (locks the price), review renders Confirm.
 */
const reachReview = async () => {
    mockInitiateWithdraw.mockResolvedValue({ data: PRICE_LOCK })
    mockStepper.step = 'amount'
    const view = render(<MantecaWithdrawFlow />)
    // the seed consumed ?amount= and asked to advance
    await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('bank-details'))

    mockStepper.step = 'bank-details'
    view.rerender(<MantecaWithdrawFlow />)
    // mark the (?destination=-prefilled) CBU valid, then submit for the price lock
    fireEvent.change(screen.getByTestId('destination-input'), { target: { value: '0000003100010000000009' } })
    fireEvent.click(screen.getByText('withdraw.review'))
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

    it('limits still loading at the price-lock boundary: bank-details submit bounces to amount', async () => {
        mockInitiateWithdraw.mockResolvedValue({ data: PRICE_LOCK })
        mockStepper.step = 'amount'
        const view = render(<MantecaWithdrawFlow />)
        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('bank-details'))

        mockStepper.step = 'bank-details'
        mockLimitsValidation.isLoading = true
        view.rerender(<MantecaWithdrawFlow />)
        mockStepperGoTo.mockClear()
        fireEvent.change(screen.getByTestId('destination-input'), { target: { value: '0000003100010000000009' } })
        fireEvent.click(screen.getByText('withdraw.review'))

        await waitFor(() => expect(mockStepperGoTo).toHaveBeenCalledWith('amount'))
        expect(mockInitiateWithdraw).not.toHaveBeenCalled()
    })
})
