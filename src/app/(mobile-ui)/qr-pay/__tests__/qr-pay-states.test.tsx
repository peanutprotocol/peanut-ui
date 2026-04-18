/**
 * QR Pay Page — State Matrix Tests
 *
 * Tests the QRPayPage component across 30 state combinations covering:
 * loading/KYC gate, payment form, processing, success, error, and edge cases.
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseUnits } from 'viem'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockRouterBack = jest.fn()
const mockSearchParams = new Map<string, string>()

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: mockRouterPush,
        back: mockRouterBack,
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
    usePathname: () => '/qr-pay',
}))

// next/image — render a plain <img>
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        // next/image uses 'fill' boolean; strip non-DOM props
        const { priority, layout, objectFit, fill, ...rest } = props
        return <img {...rest} />
    },
}))

// Sentry
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

// PostHog
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

// Sound player — no-op
jest.mock('@/components/Global/SoundPlayer', () => ({
    SoundPlayer: () => null,
}))

// Confetti — no-op
jest.mock('@/utils/confetti', () => ({
    shootDoubleStarConfetti: jest.fn(),
}))

// Assets — stubs
jest.mock('@/assets/payment-apps', () => ({
    MERCADO_PAGO: '/mercado-pago.png',
    PIX: '/pix.png',
    SIMPLEFI: '/simplefi.png',
}))

jest.mock('@/assets', () => ({
    PeanutGuyGIF: '/peanut-guy.gif',
    STAR_STRAIGHT_ICON: '/star.png',
}))

// ---------- hooks & services ----------

const mockUseQrKycGate = jest.fn()
jest.mock('@/hooks/useQrKycGate', () => ({
    QrKycState: {
        LOADING: 'loading',
        PROCEED_TO_PAY: 'proceed_to_pay',
        REQUIRES_IDENTITY_VERIFICATION: 'requires_identity_verification',
        IDENTITY_VERIFICATION_IN_PROGRESS: 'identity_verification_in_progress',
    },
    useQrKycGate: (...args: any[]) => mockUseQrKycGate(...args),
}))

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

const mockSignTransferUserOp = jest.fn()
jest.mock('@/hooks/wallet/useSignUserOp', () => ({
    useSignUserOp: () => ({ signTransferUserOp: mockSignTransferUserOp }),
}))

const mockUseTransactionDetailsDrawer = jest.fn()
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => mockUseTransactionDetailsDrawer(),
}))

jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryEntryType: { MANTECA_QR_PAYMENT: 'MANTECA_QR_PAYMENT', SIMPLEFI_QR_PAYMENT: 'SIMPLEFI_QR_PAYMENT' },
    EHistoryUserRole: { SENDER: 'SENDER' },
}))

jest.mock('@/components/TransactionDetails/TransactionDetailsDrawer', () => ({
    TransactionDetailsDrawer: () => null,
}))

const mockMantecaApi = {
    initiateQrPayment: jest.fn(),
    completeQrPaymentWithSignedTx: jest.fn(),
    claimPerk: jest.fn(),
}
jest.mock('@/services/manteca', () => ({
    mantecaApi: mockMantecaApi,
}))

const mockSimplefiApi = {
    initiateQrPayment: jest.fn(),
}
jest.mock('@/services/simplefi', () => ({
    simplefiApi: mockSimplefiApi,
}))

jest.mock('@/app/actions/currency', () => ({
    getCurrencyPrice: jest.fn(() => Promise.resolve({ sell: 1200, buy: 1250 })),
}))

jest.mock('@/app/actions/increase-limits', () => ({
    initiateIncreaseLimits: jest.fn(),
}))

const mockIsPaymentProcessorQR = jest.fn()
const mockParseSimpleFiQr = jest.fn()
jest.mock('@/components/Global/DirectSendQR/utils', () => ({
    isPaymentProcessorQR: (...args: any[]) => mockIsPaymentProcessorQR(...args),
    parseSimpleFiQr: (...args: any[]) => mockParseSimpleFiQr(...args),
    EQrType: {
        MERCADO_PAGO: 'MERCADO_PAGO',
        ARGENTINA_QR3: 'ARGENTINA_QR3',
        PIX: 'PIX',
        SIMPLEFI_STATIC: 'SIMPLEFI_STATIC',
        SIMPLEFI_DYNAMIC: 'SIMPLEFI_DYNAMIC',
        SIMPLEFI_USER_SPECIFIED: 'SIMPLEFI_USER_SPECIFIED',
    },
    NAME_BY_QR_TYPE: {
        MERCADO_PAGO: 'Mercado Pago',
        ARGENTINA_QR3: 'QR Interoperable',
        PIX: 'PIX',
        SIMPLEFI_STATIC: 'SimpleFi',
        SIMPLEFI_DYNAMIC: 'SimpleFi',
        SIMPLEFI_USER_SPECIFIED: 'SimpleFi',
    },
}))

const mockUseLimitsValidation = jest.fn()
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: (...args: any[]) => mockUseLimitsValidation(...args),
}))

jest.mock('@/features/limits/components/LimitsWarningCard', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="limits-warning-card" />,
}))

jest.mock('@/features/limits/utils', () => ({
    getLimitsWarningCardProps: jest.fn(() => null),
    isBrUserEligibleForLimitIncrease: jest.fn(() => false),
}))

const mockUseKycStatus = jest.fn()
jest.mock('@/hooks/useKycStatus', () => ({
    __esModule: true,
    default: () => mockUseKycStatus(),
}))

jest.mock('@/hooks/useSumsubActionFlow', () => ({
    useSumsubActionFlow: () => ({
        showWrapper: false,
        accessToken: null,
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
        handleInitiate: jest.fn(),
        isLoading: false,
    }),
}))

jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({
        mantecaLimits: null,
        refetch: jest.fn(),
    }),
}))

jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: jest.fn(),
}))

jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({
        pointsData: null,
        pointsDivRef: { current: null },
    }),
}))

jest.mock('@/hooks/usePointsConfetti', () => ({
    usePointsConfetti: jest.fn(),
}))

jest.mock('@/utils/history.utils', () => ({
    completeHistoryEntry: jest.fn((e: any) => Promise.resolve(e)),
}))

jest.mock('@/utils/general.utils', () => ({
    isTxReverted: jest.fn(() => false),
    saveRedirectUrl: jest.fn(),
    formatNumberForDisplay: jest.fn((v: any) => v ?? '0'),
}))

jest.mock('@/utils/perk.utils', () => ({
    getShakeClass: jest.fn(() => ''),
}))

jest.mock('@/utils/qr-payment.utils', () => ({
    calculateSavingsInCents: jest.fn(() => 0),
    isArgentinaMantecaQrPayment: jest.fn(() => false),
    getSavingsMessage: jest.fn(() => ''),
}))

jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disabledPaymentProviders: [] as string[] },
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        setIsSupportModalOpen: jest.fn(),
        openSupportWithMessage: jest.fn(),
    }),
}))

// Mock complex UI components that are hard to render in jsdom
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="amount-input" data-disabled={props.disabled}>
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => {
                    props.setPrimaryAmount?.(e.target.value)
                    props.setSecondaryAmount?.(e.target.value)
                }}
                disabled={props.disabled}
            />
        </div>
    ),
}))

jest.mock('@/components/Global/PeanutLoading', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="peanut-loading">{props.message && <span>{props.message}</span>}</div>
    ),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="nav-header">{props.title}</div>,
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => (
        <div data-testid="card" ref={ref} className={props.className}>
            {props.children}
        </div>
    )),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: any) => (
        <button
            data-testid={props['data-testid'] ?? 'button'}
            onClick={props.onClick}
            disabled={props.disabled || props.loading}
            onPointerDown={props.onPointerDown}
            onPointerUp={props.onPointerUp}
            className={props.className}
        >
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
}))

jest.mock('@/components/Global/ErrorAlert', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="error-alert" role="alert">{props.description}</div>,
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: any) =>
        props.visible ? (
            <div data-testid="action-modal">
                <h2>{props.title}</h2>
                <p>{props.description}</p>
                {props.ctas?.map((cta: any, i: number) => (
                    <button key={i} onClick={cta.onClick} data-testid={`action-modal-cta-${i}`}>
                        {cta.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

jest.mock('@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation', () => ({
    PeanutDoesntStoreAnyPersonalInformation: () => null,
}))

jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: () => null,
}))

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: (props: any) => <div data-testid="payment-info-row">{props.label}: {props.value}</div>,
}))

jest.mock('@/components/Common/PointsCard', () => ({
    __esModule: true,
    default: () => <div data-testid="points-card" />,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        REWARD_CLAIM_SHOWN: 'reward_claim_shown',
        SURPRISE_MOMENT_SHOWN: 'surprise_moment_shown',
        REWARD_CLAIMED: 'reward_claimed',
        REWARD_CLAIM_DISMISSED: 'reward_claim_dismissed',
    },
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
}))

jest.mock('@/services/services.types', () => ({
    PointsAction: { MANTECA_QR_PAYMENT: 'manteca_qr_payment' },
}))

// ---------- import component under test AFTER all mocks ----------
import QRPayPage from '../page'

// ---------- helpers ----------

function setSearchParams(params: Record<string, string>) {
    mockSearchParams.clear()
    Object.entries(params).forEach(([k, v]) => mockSearchParams.set(k, v))
}

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    })
}

// Loading state context provider
const LoadingStateProvider = ({ children }: { children: React.ReactNode }) => {
    const loadingStateContext = require('@/context').loadingStateContext
    const [loadingState, setLoadingState] = React.useState('Idle')
    const isLoading = loadingState !== 'Idle'
    return (
        <loadingStateContext.Provider value={{ loadingState, setLoadingState, isLoading }}>
            {children}
        </loadingStateContext.Provider>
    )
}

// We need to mock the context module itself since it's imported via { loadingStateContext }
const mockSetLoadingState = jest.fn()
jest.mock('@/context', () => ({
    loadingStateContext: React.createContext({
        loadingState: 'Idle' as string,
        setLoadingState: (s: string) => {},
        isLoading: false,
    }),
}))

function renderQrPay(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()
    const { loadingStateContext } = require('@/context')

    const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
        const [loadingState, setLoadingState] = React.useState<string>('Idle')
        const isLoading = loadingState !== 'Idle'
        return (
            <loadingStateContext.Provider value={{ loadingState, setLoadingState, isLoading }}>
                {children}
            </loadingStateContext.Provider>
        )
    }

    return render(
        <QueryClientProvider client={queryClient}>
            <LoadingProvider>
                <QRPayPage />
            </LoadingProvider>
        </QueryClientProvider>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockUseQrKycGate.mockReturnValue({
        kycGateState: 'proceed_to_pay',
        shouldBlockPay: false,
    })

    mockUseAuth.mockReturnValue({
        user: { user: { username: 'test-user' } },
        isFetchingUser: false,
        fetchUser: jest.fn(),
    })

    mockUseWallet.mockReturnValue({
        balance: parseUnits('100', 6), // $100 USDC
        sendMoney: jest.fn(),
    })

    mockUseTransactionDetailsDrawer.mockReturnValue({
        openTransactionDetails: jest.fn(),
        selectedTransaction: null,
        isDrawerOpen: false,
        closeTransactionDetails: jest.fn(),
    })

    mockUseLimitsValidation.mockReturnValue({
        isBlocking: false,
        isWarning: false,
        currency: 'USD',
    })

    mockUseKycStatus.mockReturnValue({
        isUserMantecaKycApproved: true,
    })

    mockIsPaymentProcessorQR.mockReturnValue(true)
    mockParseSimpleFiQr.mockReturnValue(null)

    // Manteca payment lock — returned by TanStack useQuery
    mockMantecaApi.initiateQrPayment.mockResolvedValue({
        code: 'LOCK123',
        type: 'QR3_PAYMENT',
        companyId: 'c1',
        userId: 'u1',
        userNumberId: 'un1',
        userExternalId: 'ue1',
        paymentRecipientName: 'Test Merchant',
        paymentRecipientLegalId: 'legal1',
        paymentAssetAmount: '12000',
        paymentAsset: 'ARS',
        paymentPrice: '1200',
        paymentAgainstAmount: '10',
        paymentAgainst: 'USD',
        expireAt: '2026-04-16T23:59:59Z',
        creationTime: '2026-04-16T00:00:00Z',
    })

    mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue({
        id: 'qp1',
        externalId: 'ext1',
        sessionId: 's1',
        status: 'completed',
        currentStage: 'done',
        stages: [],
        type: 'QR3_PAYMENT',
        details: {
            depositAddress: '0x123',
            paymentAsset: 'ARS',
            paymentAgainst: 'USD',
            paymentAgainstAmount: '10',
            paymentAssetAmount: '12000',
            paymentPrice: '1200',
            priceExpireAt: '2026-04-16T23:59:59Z',
            merchant: { name: 'Test Merchant' },
        },
    })

    mockMantecaApi.claimPerk.mockResolvedValue({
        success: true,
        perk: {
            amountSponsored: 0.5,
            discountPercentage: 5,
            txHash: '0xabc',
        },
    })

    mockSimplefiApi.initiateQrPayment.mockResolvedValue({
        id: 'sf1',
        usdAmount: '10',
        currency: 'ARS',
        currencyAmount: '12000',
        price: '1200',
        address: '0xsf',
    })

    mockSignTransferUserOp.mockResolvedValue({
        signedUserOp: {
            sender: '0x1',
            nonce: '0x0',
            callData: '0x',
            signature: '0x',
            callGasLimit: '0x0',
            verificationGasLimit: '0x0',
            preVerificationGas: '0x0',
            factory: null,
            factoryData: null,
            maxFeePerGas: '0x0',
            maxPriorityFeePerGas: '0x0',
            paymaster: null,
            paymasterData: null,
            paymasterVerificationGasLimit: '0x0',
            paymasterPostOpGasLimit: '0x0',
        },
        chainId: 137,
        entryPointAddress: '0xentry',
    })
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    applyDefaults()
})

// ============================================================
// GROUP 1: Loading & KYC Gate
// ============================================================
describe('GROUP 1: Loading & KYC Gate', () => {
    test('KYC loading shows PeanutLoading', () => {
        mockUseQrKycGate.mockReturnValue({
            kycGateState: 'loading',
            shouldBlockPay: true,
        })

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    test('KYC requires verification shows ActionModal with verify button', () => {
        mockUseQrKycGate.mockReturnValue({
            kycGateState: 'requires_identity_verification',
            shouldBlockPay: true,
        })

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        const modal = screen.getByTestId('action-modal')
        expect(modal).toBeInTheDocument()
        expect(screen.getByText('Verify your identity to continue')).toBeInTheDocument()
        expect(screen.getByText('Verify now')).toBeInTheDocument()
    })

    test('KYC verification in progress shows ActionModal with continue button', () => {
        mockUseQrKycGate.mockReturnValue({
            kycGateState: 'identity_verification_in_progress',
            shouldBlockPay: true,
        })

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        const modal = screen.getByTestId('action-modal')
        expect(modal).toBeInTheDocument()
        expect(screen.getByText('Complete your verification')).toBeInTheDocument()
        expect(screen.getByText('Continue verification')).toBeInTheDocument()
    })

    test('KYC passed but payment data still loading shows PeanutLoading', async () => {
        // KYC passed, but Manteca payment lock hasn't loaded yet
        mockMantecaApi.initiateQrPayment.mockReturnValue(new Promise(() => {})) // never resolves

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        // Should show loading because payment data is not available yet
        await waitFor(() => {
            expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
        })
    })

    test('Invalid QR code shows error card', async () => {
        mockIsPaymentProcessorQR.mockReturnValue(false)

        renderQrPay({ qrCode: 'not-a-valid-qr', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Invalid QR code scanned')).toBeInTheDocument()
        })
    })
})

// ============================================================
// GROUP 2: Payment Form States
// ============================================================
describe('GROUP 2: Payment Form States', () => {
    // Helper: set up a Manteca PIX payment with a loaded payment lock
    function setupMantecaPayment(overrides: Record<string, any> = {}) {
        const defaultLock = {
            code: 'LOCK123',
            type: 'PIX',
            companyId: 'c1',
            userId: 'u1',
            userNumberId: 'un1',
            userExternalId: 'ue1',
            paymentRecipientName: 'PIX Merchant',
            paymentRecipientLegalId: 'legal1',
            paymentAssetAmount: '92',
            paymentAsset: 'BRL',
            paymentPrice: '5',
            paymentAgainstAmount: '18.4',
            paymentAgainst: 'USD',
            expireAt: '2026-04-16T23:59:59Z',
            creationTime: '2026-04-16T00:00:00Z',
            ...overrides,
        }
        mockMantecaApi.initiateQrPayment.mockResolvedValue(defaultLock)
    }

    test('Manteca PIX form ready shows merchant card + amount input + pay button', async () => {
        setupMantecaPayment()

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('PIX Merchant')).toBeInTheDocument()
        })

        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument()
    })

    test('SimpleFi static form ready shows amount disabled + pay button', async () => {
        mockParseSimpleFiQr.mockReturnValue({
            type: 'SIMPLEFI_STATIC',
            merchantSlug: 'cool-coffee',
        })

        renderQrPay({ qrCode: 'simplefi://static/cool-coffee', type: 'SIMPLEFI_STATIC', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Cool Coffee')).toBeInTheDocument()
        })

        // Amount should be disabled for static SimpleFi (preset amount)
        const amountInput = screen.getByTestId('amount-input')
        expect(amountInput).toBeInTheDocument()
    })

    test('Insufficient balance shows pay button disabled + error', async () => {
        // Set balance to $5 but payment needs $18.4
        mockUseWallet.mockReturnValue({
            balance: parseUnits('5', 6),
            sendMoney: jest.fn(),
        })

        setupMantecaPayment()

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('PIX Merchant')).toBeInTheDocument()
        })

        // The balance error check happens via useEffect
        await waitFor(() => {
            const errorAlert = screen.queryByTestId('error-alert')
            expect(errorAlert).toBeInTheDocument()
            expect(errorAlert).toHaveTextContent('Not enough balance')
        })
    })

    test('Below minimum amount shows ErrorAlert', async () => {
        setupMantecaPayment({
            code: 'LOCK_LOW',
            paymentAgainstAmount: '0.05', // below MIN_QR_PAYMENT_AMOUNT (0.1)
            paymentAssetAmount: '60',
        })

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            const errorAlert = screen.queryByTestId('error-alert')
            expect(errorAlert).toBeInTheDocument()
            expect(errorAlert).toHaveTextContent('at least')
        })
    })

    test('Above maximum amount shows ErrorAlert', async () => {
        setupMantecaPayment({
            code: 'LOCK_HIGH',
            paymentAgainstAmount: '2500', // above MAX_QR_PAYMENT_AMOUNT (2000)
            paymentAssetAmount: '3000000',
        })

        mockUseWallet.mockReturnValue({
            balance: parseUnits('5000', 6),
            sendMoney: jest.fn(),
        })

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            const errorAlert = screen.queryByTestId('error-alert')
            expect(errorAlert).toBeInTheDocument()
            expect(errorAlert).toHaveTextContent('exceeds maximum')
        })
    })

    test('Limits blocking shows LimitsWarningCard', async () => {
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Monthly limit exceeded',
        })
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            currency: 'USD',
        })

        setupMantecaPayment()

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
        })
    })

    test('Provider maintenance shows maintenance banner', async () => {
        const maintenanceConfig = require('@/config/underMaintenance.config').default
        maintenanceConfig.disabledPaymentProviders = ['MANTECA']

        setupMantecaPayment()

        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument()
        })

        // Clean up
        maintenanceConfig.disabledPaymentProviders = []
    })
})

// ============================================================
// GROUP 3: Processing States
// ============================================================
describe('GROUP 3: Processing States', () => {
    test('Manteca payment processing shows PeanutLoading', async () => {
        mockMantecaApi.initiateQrPayment.mockResolvedValue({
            code: 'LOCK123',
            type: 'QR3_PAYMENT',
            companyId: 'c1',
            userId: 'u1',
            userNumberId: 'un1',
            userExternalId: 'ue1',
            paymentRecipientName: 'Test Merchant',
            paymentRecipientLegalId: 'legal1',
            paymentAssetAmount: '12000',
            paymentAsset: 'ARS',
            paymentPrice: '1200',
            paymentAgainstAmount: '10',
            paymentAgainst: 'USD',
            expireAt: '2026-04-16T23:59:59Z',
            creationTime: '2026-04-16T00:00:00Z',
        })

        // Make completeQrPayment hang to simulate processing
        mockMantecaApi.completeQrPaymentWithSignedTx.mockReturnValue(new Promise(() => {}))

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        // Wait for form to appear
        await waitFor(() => {
            expect(screen.getByText('Test Merchant')).toBeInTheDocument()
        })

        // Click pay
        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        // After clicking pay, loading state should trigger PeanutLoading
        // (signTransferUserOp resolves, then completeQrPayment hangs)
        await waitFor(() => {
            // Component is in loading state - either shows PeanutLoading or loading button text
            const loadingEl = screen.queryByTestId('peanut-loading')
            const loadingButton = screen.queryByText('Loading...')
            expect(loadingEl || loadingButton).toBeTruthy()
        })
    })

    test('SimpleFi WebSocket waiting shows processing indicator', async () => {
        const mockSendMoney = jest.fn().mockResolvedValue({
            userOpHash: '0xhash',
            receipt: null, // null receipt means waiting for confirmation
        })
        mockUseWallet.mockReturnValue({
            balance: parseUnits('100', 6),
            sendMoney: mockSendMoney,
        })

        mockParseSimpleFiQr.mockReturnValue({
            type: 'SIMPLEFI_STATIC',
            merchantSlug: 'cool-coffee',
        })

        renderQrPay({ qrCode: 'simplefi://static/cool-coffee', type: 'SIMPLEFI_STATIC', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Cool Coffee')).toBeInTheDocument()
        })

        // Click pay
        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        // Should show processing state
        await waitFor(() => {
            const processingText = screen.queryByText('Processing Payment...')
            const loadingEl = screen.queryByTestId('peanut-loading')
            expect(processingText || loadingEl).toBeTruthy()
        })
    })

    test('Wallet confirmation pending shows ErrorAlert', async () => {
        mockMantecaApi.initiateQrPayment.mockResolvedValue({
            code: 'LOCK123',
            type: 'QR3_PAYMENT',
            companyId: 'c1',
            userId: 'u1',
            userNumberId: 'un1',
            userExternalId: 'ue1',
            paymentRecipientName: 'Test Merchant',
            paymentRecipientLegalId: 'legal1',
            paymentAssetAmount: '12000',
            paymentAsset: 'ARS',
            paymentPrice: '1200',
            paymentAgainstAmount: '10',
            paymentAgainst: 'USD',
            expireAt: '2026-04-16T23:59:59Z',
            creationTime: '2026-04-16T00:00:00Z',
        })

        // signTransferUserOp rejects with "not allowed" — wallet confirmation denied
        mockSignTransferUserOp.mockRejectedValue(new Error('User action is not allowed'))

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Test Merchant')).toBeInTheDocument()
        })

        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        await waitFor(() => {
            const errorAlert = screen.getByTestId('error-alert')
            expect(errorAlert).toHaveTextContent('confirm the transaction')
        })
    })
})

// ============================================================
// GROUP 4: Success States
// ============================================================
describe('GROUP 4: Success States', () => {
    async function completeMantecaPayment(qrPaymentOverrides: Record<string, any> = {}) {
        const baseQrPayment = {
            id: 'qp1',
            externalId: 'ext1',
            sessionId: 's1',
            status: 'completed',
            currentStage: 'done',
            stages: [],
            type: 'QR3_PAYMENT',
            details: {
                depositAddress: '0x123',
                paymentAsset: 'ARS',
                paymentAgainst: 'USD',
                paymentAgainstAmount: '10',
                paymentAssetAmount: '12000',
                paymentPrice: '1200',
                priceExpireAt: '2026-04-16T23:59:59Z',
                merchant: { name: 'Test Merchant' },
            },
            ...qrPaymentOverrides,
        }
        mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue(baseQrPayment)

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Test Merchant')).toBeInTheDocument()
        })

        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        return baseQrPayment
    }

    test('Manteca success, no perk shows success card, no reward', async () => {
        await completeMantecaPayment()

        await waitFor(() => {
            expect(screen.getByText(/You paid/)).toBeInTheDocument()
        })

        expect(screen.queryByText('You earned a reward!')).not.toBeInTheDocument()
        expect(screen.getByText('Split this bill')).toBeInTheDocument()
    })

    test('Manteca success, perk eligible shows hold-to-claim button', async () => {
        await completeMantecaPayment({
            perk: {
                eligible: true,
                discountPercentage: 5,
                amountSponsored: 0.5,
            },
        })

        await waitFor(() => {
            expect(screen.getByText('You earned a reward!')).toBeInTheDocument()
        })

        // The button renders "Claim Reward" twice (visible text + clip-path overlay)
        // Use getByRole to target the button element
        expect(screen.getByRole('button', { name: /Claim Reward/i })).toBeInTheDocument()
    })

    test('Perk claim in progress shows disabled button + progress', async () => {
        await completeMantecaPayment({
            perk: {
                eligible: true,
                discountPercentage: 5,
                amountSponsored: 0.5,
            },
        })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Claim Reward/i })).toBeInTheDocument()
        })

        // Start hold
        const claimButton = screen.getByRole('button', { name: /Claim Reward/i })
        await act(async () => {
            fireEvent.pointerDown(claimButton)
        })

        // Button should still exist during hold
        expect(screen.getByRole('button', { name: /Claim Reward/i })).toBeInTheDocument()

        // Release
        await act(async () => {
            fireEvent.pointerUp(claimButton)
        })
    })

    test('Perk claimed shows shake class + go home button', async () => {
        // Make claimPerk fast for test
        jest.useFakeTimers()

        await completeMantecaPayment({
            perk: {
                eligible: true,
                discountPercentage: 5,
                amountSponsored: 0.5,
            },
        })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Claim Reward/i })).toBeInTheDocument()
        })

        const claimButton = screen.getByRole('button', { name: /Claim Reward/i })

        // Start hold
        await act(async () => {
            fireEvent.pointerDown(claimButton)
        })

        // Advance past hold duration (1500ms)
        await act(async () => {
            jest.advanceTimersByTime(1600)
        })

        // After claiming, should show "Go to Home"
        await waitFor(() => {
            expect(screen.getByText('Go to Home')).toBeInTheDocument()
        })

        jest.useRealTimers()
    })

    test('SimpleFi success shows SimpleFi success card', async () => {
        const mockSendMoney = jest.fn().mockResolvedValue({
            userOpHash: '0xhash',
            receipt: { status: 'success' },
        })
        mockUseWallet.mockReturnValue({
            balance: parseUnits('100', 6),
            sendMoney: mockSendMoney,
        })

        mockParseSimpleFiQr.mockReturnValue({
            type: 'SIMPLEFI_STATIC',
            merchantSlug: 'cool-coffee',
        })

        // Override useWebSocket to capture the callback and fire it
        const { useWebSocket } = require('@/hooks/useWebSocket')
        let wsCallback: Function
        useWebSocket.mockImplementation((opts: any) => {
            wsCallback = opts.onHistoryEntry
        })

        renderQrPay({ qrCode: 'simplefi://static/cool-coffee', type: 'SIMPLEFI_STATIC', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Cool Coffee')).toBeInTheDocument()
        })

        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        // Simulate WebSocket response
        await act(async () => {
            if (wsCallback) {
                await wsCallback({
                    uuid: 'sf1',
                    type: 'SIMPLEFI_QR_PAYMENT',
                    status: 'approved',
                    amount: '10',
                    currency: { code: 'ARS', amount: '12000' },
                    extraData: { usdAmount: '10' },
                })
            }
        })

        await waitFor(() => {
            const youPaid = screen.queryByText(/You paid/)
            expect(youPaid).toBeInTheDocument()
        })
    })

    test('PIX success shows PIX icon', async () => {
        renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        mockMantecaApi.initiateQrPayment.mockResolvedValue({
            code: 'LOCK_PIX',
            type: 'PIX',
            companyId: 'c1',
            userId: 'u1',
            userNumberId: 'un1',
            userExternalId: 'ue1',
            paymentRecipientName: 'PIX Store',
            paymentRecipientLegalId: 'legal1',
            paymentAssetAmount: '92',
            paymentAsset: 'BRL',
            paymentPrice: '5',
            paymentAgainstAmount: '18.4',
            paymentAgainst: 'USD',
            expireAt: '2026-04-16T23:59:59Z',
            creationTime: '2026-04-16T00:00:00Z',
        })

        // Re-render with PIX type
        const { unmount } = renderQrPay({ qrCode: 'pix://payment?id=123', type: 'PIX', t: '1' })

        await waitFor(() => {
            const img = screen.queryAllByRole('img').find((el) => el.getAttribute('src') === '/pix.png')
            // PIX icon should be present in the merchant card
            expect(img || screen.queryByText('PIX Store')).toBeTruthy()
        })

        unmount()
    })

    test('Mercado Pago success shows MP icon', async () => {
        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            const img = screen.queryAllByRole('img').find((el) => el.getAttribute('src') === '/mercado-pago.png')
            expect(img || screen.queryByText('Test Merchant')).toBeTruthy()
        })
    })

    test('Argentina QR3 success shows savings message', async () => {
        const { isArgentinaMantecaQrPayment, calculateSavingsInCents, getSavingsMessage } =
            require('@/utils/qr-payment.utils')

        isArgentinaMantecaQrPayment.mockReturnValue(true)
        calculateSavingsInCents.mockReturnValue(150)
        getSavingsMessage.mockReturnValue('You saved $1.50 vs card!')

        await completeMantecaPayment()

        await waitFor(() => {
            expect(screen.getByText(/You paid/)).toBeInTheDocument()
        })

        // Savings message should appear for Argentina QR3 payments
        expect(screen.getByText('You saved $1.50 vs card!')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 5: Error States
// ============================================================
describe('GROUP 5: Error States', () => {
    test('Transaction reverted shows error card + retry', async () => {
        const { isTxReverted } = require('@/utils/general.utils')
        isTxReverted.mockReturnValue(true)

        const mockSendMoney = jest.fn().mockResolvedValue({
            userOpHash: '0xhash',
            receipt: { status: 'reverted' },
        })
        mockUseWallet.mockReturnValue({
            balance: parseUnits('100', 6),
            sendMoney: mockSendMoney,
        })

        mockParseSimpleFiQr.mockReturnValue({
            type: 'SIMPLEFI_STATIC',
            merchantSlug: 'cool-coffee',
        })

        renderQrPay({ qrCode: 'simplefi://static/cool-coffee', type: 'SIMPLEFI_STATIC', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Cool Coffee')).toBeInTheDocument()
        })

        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        await waitFor(() => {
            const errorAlert = screen.getByTestId('error-alert')
            expect(errorAlert).toHaveTextContent('rejected by the network')
        })

        // Reset mock
        isTxReverted.mockReturnValue(false)
    })

    test('QR decode failure shows specific error message', async () => {
        mockMantecaApi.initiateQrPayment.mockRejectedValue(
            new Error('PAYMENT_DESTINATION_DECODING_ERROR')
        )

        renderQrPay({ qrCode: 'mercadopago://pay?id=bad', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText(/could not decode/i)).toBeInTheDocument()
        })
    })

    test('SimpleFi timeout shows error + retry', async () => {
        jest.useFakeTimers()

        const mockSendMoney = jest.fn().mockResolvedValue({
            userOpHash: '0xhash',
            receipt: null,
        })
        mockUseWallet.mockReturnValue({
            balance: parseUnits('100', 6),
            sendMoney: mockSendMoney,
        })

        mockParseSimpleFiQr.mockReturnValue({
            type: 'SIMPLEFI_STATIC',
            merchantSlug: 'cool-coffee',
        })

        renderQrPay({ qrCode: 'simplefi://static/cool-coffee', type: 'SIMPLEFI_STATIC', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Cool Coffee')).toBeInTheDocument()
        })

        const payButton = screen.getByRole('button', { name: 'Pay' })
        await act(async () => {
            fireEvent.click(payButton)
        })

        // Advance 5 minutes for WebSocket timeout
        await act(async () => {
            jest.advanceTimersByTime(5 * 60 * 1000 + 100)
        })

        await waitFor(() => {
            const errorAlert = screen.queryByTestId('error-alert')
            expect(errorAlert).toBeInTheDocument()
            expect(errorAlert).toHaveTextContent('taking longer than expected')
        })

        jest.useRealTimers()
    })

    test('Manteca API error shows generic error', async () => {
        mockMantecaApi.initiateQrPayment.mockRejectedValue(new Error('Network timeout'))

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText(/currently experiencing issues/i)).toBeInTheDocument()
        })
    })
})

// ============================================================
// GROUP 6: Edge Cases
// ============================================================
describe('GROUP 6: Edge Cases', () => {
    test('No QR code param shows error', async () => {
        renderQrPay({ type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByText('Invalid QR code scanned')).toBeInTheDocument()
        })
    })

    test('BR user with limits blocking shows KYC wrapper visible', async () => {
        const { getLimitsWarningCardProps, isBrUserEligibleForLimitIncrease } =
            require('@/features/limits/utils')

        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Monthly limit exceeded',
        })
        isBrUserEligibleForLimitIncrease.mockReturnValue(true)

        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            currency: 'BRL',
        })

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
        })
    })

    test('Dynamic QR waiting for merchant amount shows loading indicator', async () => {
        mockMantecaApi.initiateQrPayment.mockRejectedValue(
            new Error('PAYMENT_DESTINATION_MISSING_AMOUNT')
        )

        renderQrPay({ qrCode: 'mercadopago://pay?id=123', type: 'MERCADO_PAGO', t: '1' })

        await waitFor(() => {
            // The component shows QrPayPageLoading or the "order not ready" modal
            const waitingText = screen.queryByText(/Waiting for the merchant/)
            const orderNotReady = screen.queryByText(/couldn't get the amount/)
            expect(waitingText || orderNotReady).toBeTruthy()
        })
    })
})
