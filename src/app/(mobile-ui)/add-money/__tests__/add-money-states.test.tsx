/**
 * Add Money Flow — State Matrix Tests
 *
 * Tests the AddMoney pages across state combinations covering:
 * - Landing / method selection
 * - Crypto deposit (Rhino)
 * - Bridge bank onramp (SEPA, US, UK, MX)
 * - Manteca deposit (AR, BR)
 * - KYC gate states
 * - Error states
 * - Loading states
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports, react/display-name, @next/next/no-img-element */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockRouterBack = jest.fn()
const mockRouterReplace = jest.fn()
const mockSearchParams = new Map<string, string>()
const mockParams: Record<string, string> = {}

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: mockRouterPush,
        back: mockRouterBack,
        replace: mockRouterReplace,
        prefetch: jest.fn(),
    }),
    usePathname: () => '/add-money',
    useParams: () => mockParams,
}))

// nuqs — mock useQueryState and useQueryStates for URL state management
const mockQueryState: Record<string, any> = {}
const mockSetQueryState = jest.fn((updates: Record<string, any>) => {
    Object.entries(updates).forEach(([k, v]) => {
        mockQueryState[k] = v
    })
})

jest.mock('nuqs', () => ({
    useQueryState: (key: string, _parser?: any) => {
        const value = mockQueryState[key] ?? null
        const setter = (val: any) => {
            mockQueryState[key] = val
            mockSetQueryState({ [key]: val })
        }
        return [value, setter]
    },
    useQueryStates: (_parsers: any, _opts?: any) => {
        return [mockQueryState, mockSetQueryState]
    },
    parseAsString: { withDefault: (d: string) => d },
    parseAsStringEnum: (_values: string[]) => ({
        withDefault: (d: string) => d,
    }),
}))

// next/image — render a plain <img>
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
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

// Assets
jest.mock('@/assets', () => ({
    SOLANA_ICON: '/solana.png',
    TRON_ICON: '/tron.png',
    MERCADO_PAGO: '/mercado-pago.png',
    PIX: '/pix.png',
}))

jest.mock('@/assets/payment-apps', () => ({
    MERCADO_PAGO: '/mercado-pago.png',
    PIX: '/pix.png',
}))

// ---------- hooks & services ----------

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

// useKycStatus was deleted in the capability rip-out — its jest.mock is removed.
// The jest.fn is retained only because two legacy setup calls below still call
// .mockReturnValue on it; they're no-ops now (the component reads useCapabilities).
const mockUseKycStatus = jest.fn()

// Bridge gate is now derived inline from useCapabilities() via the real
// deriveBridgeGate util (bridge-gate.utils is intentionally NOT mocked, so the
// gate state mapping is exercised end-to-end). Per-test we set fixture rails +
// nextActions on useCapabilities; `setGate(type)` builds the minimal capability
// shape that the real deriveBridgeGate resolves to that gate type.
const mockUseCapabilities = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => mockUseCapabilities(),
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        setIsSupportModalOpen: jest.fn(),
        setIsQRScannerOpen: jest.fn(),
        openSupportWithMessage: jest.fn(),
    }),
}))

jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        isLoading: false,
        error: null,
        showWrapper: false,
        handleInitiateKyc: jest.fn(),
        handleSelfHealResubmit: jest.fn(),
    }),
}))

const mockUseCurrency = jest.fn()
jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: (...args: any[]) => mockUseCurrency(...args),
}))

const mockUseExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (...args: any[]) => mockUseExchangeRate(...args),
}))

const mockUseCreateOnramp = jest.fn()
jest.mock('@/hooks/useCreateOnramp', () => ({
    useCreateOnramp: () => mockUseCreateOnramp(),
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

const mockUseMultiPhaseKycFlow = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: (...args: any[]) => mockUseMultiPhaseKycFlow(...args),
}))

const mockUseTosGuard = jest.fn()
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => mockUseTosGuard(),
}))

// OnrampFlowContext
const mockOnrampFlow = {
    error: { showError: false, errorMessage: '' },
    setError: jest.fn(),
    fromBankSelected: false,
    setFromBankSelected: jest.fn(),
    onrampData: null as any,
    setOnrampData: jest.fn(),
    resetOnrampFlow: jest.fn(),
}
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => mockOnrampFlow,
}))

// RequestFulfillmentFlowContext
jest.mock('@/context/RequestFulfillmentFlowContext', () => ({
    RequestFulfillmentBankFlowStep: { BankCountryList: 'BankCountryList' },
    useRequestFulfillmentFlow: () => ({
        setFlowStep: jest.fn(),
        onrampData: null,
        selectedCountry: null,
    }),
}))

// Manteca API
const mockMantecaApi = {
    deposit: jest.fn(),
}
jest.mock('@/services/manteca', () => ({
    mantecaApi: mockMantecaApi,
}))

// Rhino API
const mockRhinoApi = {
    createDepositAddress: jest.fn(),
    getDepositAddressStatus: jest.fn(),
    resetDepositAddressStatus: jest.fn(),
}
jest.mock('@/services/rhino', () => ({
    rhinoApi: mockRhinoApi,
}))

// Bridge utils
jest.mock('@/utils/bridge.utils', () => ({
    getCurrencyConfig: jest.fn((_countryId: string, _flow: string) => ({
        currency: 'usd',
    })),
    getCurrencySymbol: jest.fn((currency: string) => {
        const map: Record<string, string> = {
            usd: '$',
            eur: '\u20AC',
            gbp: '\u00A3',
            mxn: 'MX$',
            USD: '$',
            EUR: '\u20AC',
        }
        return map[currency] ?? currency
    }),
    getMinimumAmount: jest.fn(() => 1),
    railJurisdictionForBank: jest.fn(() => 'EU'),
}))

// Country currency mappings
jest.mock('@/constants/countryCurrencyMapping', () => ({
    __esModule: true,
    default: [
        { country: 'mexico', currencyCode: 'MXN', path: 'mexico' },
        { country: 'germany', currencyCode: 'EUR', path: 'germany' },
    ],
    isNonEuroSepaCountry: jest.fn(() => false),
    isUKCountry: jest.fn(() => false),
    getFlagUrl: jest.fn((iso2: string) => `/flags/${iso2}.svg`),
}))

// Rhino consts
jest.mock('@/constants/rhino.consts', () => ({
    CHAIN_LOGOS: { ETHEREUM: '/eth.png', SOLANA: '/sol.png', TRON: '/tron.png' },
    SUPPORTED_EVM_CHAINS: ['ETHEREUM', 'ARBITRUM', 'POLYGON'],
    NETWORK_LABELS: { EVM: 'EVM', SOL: 'Solana', TRON: 'Tron' },
    NETWORK_LOGOS: { EVM: '/evm.png', SOL: '/sol.png', TRON: '/tron.png' },
    getSupportedTokens: jest.fn(() => [
        { name: 'USDC', logoUrl: '/usdc.png' },
        { name: 'USDT', logoUrl: '/usdt.png' },
        { name: 'ETH', logoUrl: '/eth-token.png' },
    ]),
    TOKEN_LOGOS: { USDC: '/usdc.png', USDT: '/usdt.png', ETH: '/eth-token.png' },
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/constants/payment.consts', () => ({
    MIN_MANTECA_DEPOSIT_AMOUNT: 1,
    BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME: 'Bridge Financial',
    resolveBridgeAccountHolderName: (name?: string | null) => name || 'Bridge Financial',
}))

jest.mock('@/constants/manteca.consts', () => ({
    MANTECA_ARG_DEPOSIT_CUIT: '30-12345678-9',
    MANTECA_ARG_DEPOSIT_NAME: 'Manteca SA',
    MANTECA_SUPPORTED_EXCHANGES: {
        AR: 'ARGENTINA',
        BR: 'BRAZIL',
    },
    isMantecaCountry: (countryPath: string) => ['argentina', 'brazil'].includes(countryPath),
    isMantecaSupportedCountryCode: (countryCode: string) => ['AR', 'BR'].includes(countryCode?.toUpperCase()),
    MANTECA_COUNTRIES_CONFIG: {
        AR: { depositAddressLabel: 'CBU/CVU' },
        BR: { depositAddressLabel: 'PIX Key' },
    },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        DEPOSIT_METHOD_SELECTED: 'deposit_method_selected',
        DEPOSIT_AMOUNT_ENTERED: 'deposit_amount_entered',
        DEPOSIT_CONFIRMED: 'deposit_confirmed',
        DEPOSIT_COMPLETED: 'deposit_completed',
        DEPOSIT_FAILED: 'deposit_failed',
    },
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
}))

// General utils
jest.mock('@/utils/general.utils', () => ({
    formatAmount: jest.fn((v: any) => v?.toString() ?? '0'),
    getExplorerUrl: jest.fn(() => 'https://arbiscan.io'),
    saveRedirectUrl: jest.fn(),
    getRedirectUrl: jest.fn(() => null),
    clearRedirectUrl: jest.fn(),
    getFromLocalStorage: jest.fn(() => null),
    isCryptoAddress: jest.fn(() => false),
    printableAddress: jest.fn((a: string) => a),
    shortenStringLong: jest.fn((s: string, n: number) => s.slice(0, n) + '...' + s.slice(-n)),
    formatCurrency: jest.fn((v: any) => v?.toString() ?? '0'),
    checkIfInternalNavigation: jest.fn(() => false),
    formatNumberForDisplay: jest.fn((v: any) => v ?? '0'),
}))

jest.mock('@/utils/currency', () => ({
    formatCurrencyAmount: jest.fn((amount: string, currency: string) => `${currency} ${amount}`),
}))

jest.mock('@/utils/format.utils', () => ({
    formatBankAccountDisplay: jest.fn((val: string) => val),
}))

// ---------- UI component mocks ----------

jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="amount-input">
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => {
                    props.setPrimaryAmount?.(e.target.value)
                    props.setSecondaryAmount?.(e.target.value)
                    props.setDisplayedAmount?.(e.target.value)
                }}
            />
        </div>
    ),
}))

jest.mock('@/components/Global/PeanutLoading', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="peanut-loading">{props.message && <span>{props.message}</span>}</div>,
}))

jest.mock('@/components/Global/PeanutLoading/CyclingLoading', () => ({
    __esModule: true,
    default: () => <div data-testid="cycling-loading" />,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="nav-header" onClick={props.onPrev}>
            {props.title}
        </div>
    ),
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => (
        <div data-testid="card" ref={ref} className={props.className}>
            {props.children}
        </div>
    )),
}))

jest.mock('@/components/0_Bruddle/Card', () => ({
    Card: (props: any) => (
        <div data-testid="bruddle-card" className={props.className}>
            {props.children}
        </div>
    ),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: any) => (
        <button
            data-testid={props['data-testid'] ?? 'button'}
            onClick={props.onClick}
            disabled={props.disabled || props.loading}
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
    default: (props: any) => (
        <div data-testid="error-alert" role="alert">
            {props.description}
        </div>
    ),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: any) =>
        props.visible ? (
            <div data-testid="action-modal">
                <h2>{props.title}</h2>
                <p>{props.description}</p>
                {props.content}
                {props.footer}
            </div>
        ) : null,
}))

jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="info-card">
            {props.title && <span>{props.title}</span>}
            {props.description && <span>{props.description}</span>}
            {props.items?.map((item: any, i: number) => (
                <span key={i}>{item}</span>
            ))}
            {props.customContent}
        </div>
    ),
}))

jest.mock('@/components/Global/CopyToClipboard', () => {
    const CopyToClipboard = React.forwardRef((props: any, ref: any) => (
        <span data-testid="copy-to-clipboard" ref={ref} />
    ))
    CopyToClipboard.displayName = 'CopyToClipboard'
    return {
        __esModule: true,
        default: CopyToClipboard,
    }
})

jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="qr-code">{props.url}</div>,
}))

jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: (props: any) => (
        <button data-testid="share-button" onClick={props.onClick}>
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/Global/EmptyStates/EmptyState', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="empty-state">
            <span>{props.title}</span>
            <span>{props.description}</span>
        </div>
    ),
}))

jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="page-container">{props.children}</div>,
}))

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: (props: any) => (
        <div data-testid="payment-info-row">
            {props.label}: {props.value}
        </div>
    ),
}))

jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => null,
}))

jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: any) =>
        props.visible ? (
            <div data-testid="initiate-kyc-modal">
                <button data-testid="kyc-verify-button" onClick={props.onVerify}>
                    Verify
                </button>
            </div>
        ) : null,
}))

jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: any) => (props.visible ? <div data-testid="bridge-tos-step">Bridge TOS</div> : null),
}))

jest.mock('@/components/AddMoney/components/OnrampConfirmationModal', () => ({
    OnrampConfirmationModal: (props: any) =>
        props.visible ? (
            <div data-testid="onramp-confirmation-modal">
                <span>
                    Amount: {props.currency}
                    {props.amount}
                </span>
                <button data-testid="confirm-onramp" onClick={props.onConfirm}>
                    Confirm
                </button>
            </div>
        ) : null,
}))

jest.mock('@/components/ActionListCard', () => ({
    ActionListCard: (props: any) => (
        <div data-testid={`action-card-${props.title?.toLowerCase().replace(/\s+/g, '-')}`} onClick={props.onClick}>
            <span>{props.title}</span>
            <span>{props.description}</span>
        </div>
    ),
}))

jest.mock('@/components/Profile/AvatarWithBadge', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="avatar-badge" />,
}))

jest.mock('@/components/AddMoney/components/ChooseNetworkDrawer', () => ({
    __esModule: true,
    default: (props: any) =>
        props.open ? (
            <div data-testid="choose-network-drawer">
                <button data-testid="select-evm" onClick={() => props.onSelect('EVM')}>
                    EVM
                </button>
                <button data-testid="select-sol" onClick={() => props.onSelect('SOL')}>
                    Solana
                </button>
                <button data-testid="select-tron" onClick={() => props.onSelect('TRON')}>
                    Tron
                </button>
            </div>
        ) : null,
}))

jest.mock('@/components/AddMoney/components/ChainChip', () => ({
    __esModule: true,
    default: (props: any) => <span data-testid="chain-chip">{props.chainName}</span>,
}))

jest.mock('@/components/AddMoney/components/HowToDepositModal', () => ({
    __esModule: true,
    default: (props: any) => (props.visible ? <div data-testid="how-to-deposit-modal">How to Deposit</div> : null),
}))

jest.mock('@/components/AddMoney/components/SupportedNetworksModal', () => ({
    __esModule: true,
    default: (props: any) =>
        props.visible ? <div data-testid="supported-networks-modal">Supported Networks</div> : null,
}))

jest.mock('@/components/Tooltip', () => ({
    Tooltip: (props: any) => <div>{props.children}</div>,
}))

// Crypto deposit polling hook
const mockUseCryptoDepositPolling = jest.fn()
jest.mock('@/components/AddMoney/hooks/useCryptoDepositPolling', () => ({
    useCryptoDepositPolling: (...args: any[]) => mockUseCryptoDepositPolling(...args),
}))

// updateUserById — the offramp handle gate persists the migrant's offramp.xyz
// username/email through this server action
const mockUpdateUserById = jest.fn()
jest.mock('@/app/actions/users', () => ({
    ...jest.requireActual('@/app/actions/users'),
    updateUserById: (...args: any[]) => mockUpdateUserById(...args),
}))

// Country list
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: (props: any) => (
        <div data-testid="country-list">
            <span>{props.inputTitle}</span>
            <button
                data-testid="country-argentina"
                onClick={() => props.onCountryClick({ path: 'argentina', id: 'AR' })}
            >
                Argentina
            </button>
            <button data-testid="country-germany" onClick={() => props.onCountryClick({ path: 'germany', id: 'DE' })}>
                Germany
            </button>
            <button data-testid="country-chad" onClick={() => props.onCountryClick({ path: 'chad', id: 'TD' })}>
                Chad
            </button>
        </div>
    ),
}))

// AddWithdrawCountriesList
jest.mock('@/components/AddWithdraw/AddWithdrawCountriesList', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="add-withdraw-countries-list">
            <span>Flow: {props.flow}</span>
        </div>
    ),
}))

// MantecaAddMoney (for regional-method page)
jest.mock('@/components/AddMoney/components/MantecaAddMoney', () => ({
    __esModule: true,
    default: () => <div data-testid="manteca-add-money">Manteca Add Money</div>,
}))

// MantecaTransfersMaintenanceView — the outage screen shown when a currency is
// in disabledMantecaCurrencies. Mocked to a testid so GROUP 7 can assert which
// branch the regional-method route renders without pulling the real Card tree.
jest.mock('@/components/Global/Banner/MantecaTransfersMaintenanceView', () => ({
    __esModule: true,
    MantecaTransfersMaintenanceView: () => <div data-testid="manteca-transfers-maintenance">Manteca Maintenance</div>,
}))

// AddMoneyBankDetails (for US bank page and bank details step)
jest.mock('@/components/AddMoney/components/AddMoneyBankDetails', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="add-money-bank-details">Bank Details (flow: {props.flow ?? 'add-money'})</div>
    ),
}))

// MantecaDepositShareDetails
jest.mock('@/components/AddMoney/components/MantecaDepositShareDetails', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="manteca-deposit-share-details">Manteca Deposit Details</div>,
}))

// PaymentSuccessView
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="payment-success-view">
            <span>{props.headerTitle}</span>
            <span>Amount: {props.usdAmount}</span>
            <button data-testid="success-complete" onClick={props.onComplete}>
                Done
            </button>
        </div>
    ),
}))

// Hooks used by auto-truncated address
jest.mock('@/hooks/useAutoTruncatedAddress', () => ({
    useAutoTruncatedAddress: (address: string) => ({
        containerRef: { current: null },
        truncatedAddress: address ? address.slice(0, 8) + '...' + address.slice(-6) : '',
    }),
}))

jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryUserRole: { RECIPIENT: 'RECIPIENT' },
}))

jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="user-card">{props.username}</div>,
}))

jest.mock('@/components/Slider', () => ({
    Slider: (props: any) => (
        <button data-testid="slider" onClick={() => props.onValueChange?.(true)}>
            Slide to confirm
        </button>
    ),
}))

// Consts for AddMoney
jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [
        { type: 'country', id: 'AR', path: 'argentina', currency: 'ARS', iso3: 'ARG' },
        { type: 'country', id: 'BR', path: 'brazil', currency: 'BRL', iso3: 'BRA' },
        { type: 'country', id: 'US', path: 'us', currency: 'USD', iso3: 'USA' },
        { type: 'country', id: 'DE', path: 'germany', currency: 'EUR', iso3: 'DEU' },
        { type: 'country', id: 'MX', path: 'mexico', currency: 'MXN', iso3: 'MEX' },
        { type: 'country', id: 'GB', path: 'uk', currency: 'GBP', iso3: 'GBR' },
        { type: 'country', id: 'XX', path: 'unknown', currency: 'USD', iso3: 'XXX' },
    ],
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2: { ARG: 'AR', BRA: 'BR', USA: 'US', DEU: 'DE', MEX: 'MX', GBR: 'GB' },
    BRIDGE_ALPHA3_TO_ALPHA2: { USA: 'US', DEU: 'DE', MEX: 'MX', GBR: 'GB' },
}))

jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({}))

// Radix tabs for RhinoDeposit view
jest.mock('@radix-ui/react-tabs', () => ({
    Root: (props: any) => <div data-testid="tabs-root">{props.children}</div>,
    List: (props: any) => <div data-testid="tabs-list">{props.children}</div>,
    Trigger: (props: any) => (
        <button data-testid={`tab-${props.value}`} onClick={() => {}}>
            {props.children}
        </button>
    ),
}))

// Drawer
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: (props: any) => (props.open ? <div data-testid="drawer">{props.children}</div> : null),
    DrawerContent: (props: any) => <div>{props.children}</div>,
    DrawerHeader: (props: any) => <div>{props.children}</div>,
    DrawerTitle: (props: any) => <h2>{props.children}</h2>,
    DrawerDescription: (props: any) => <p>{props.children}</p>,
}))

// ---------- import components under test AFTER all mocks ----------

import AddMoneyPage from '../page'
import AddMoneyCryptoPage from '../crypto/page'
import OnrampBankPage from '../[country]/bank/page'
import AddMoneyRegionalMethodPage from '../[country]/[regional-method]/page'
import AddMoneyCountryPage from '../[country]/page'
import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import underMaintenanceConfig from '@/config/underMaintenance.config'

// ---------- helpers ----------

function resetQueryState(initial: Record<string, any> = {}) {
    Object.keys(mockQueryState).forEach((k) => delete mockQueryState[k])
    Object.entries(initial).forEach(([k, v]) => {
        mockQueryState[k] = v
    })
}

function setParams(params: Record<string, string>) {
    Object.keys(mockParams).forEach((k) => delete mockParams[k])
    Object.entries(params).forEach(([k, v]) => {
        mockParams[k] = v
    })
}

// Build the minimal capability fixture that maps to a specific GateState kind,
// then push it onto the useCapabilities mock. The page reads `gateFor(...)`,
// so the mock returns a stub gateFor closing over the desired state; it also
// exposes `bankRails()` for the few sites that read it directly.
type Gate =
    | 'ready'
    | 'accept-tos'
    | 'fixable-rejection'
    | 'blocked-rejection'
    | 'needs-identity'
    | 'needs-enrollment'
    | 'waiting-on-provider'

function setGate(kind: Gate) {
    let rails: any[] = []
    let nextActions: any[] = []
    let isKycApproved = false
    let gateState: any = { kind: 'loading' }

    switch (kind) {
        case 'ready':
            rails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    country: 'US',
                    currency: 'USD',
                    status: 'enabled',
                },
            ]
            isKycApproved = true
            gateState = { kind: 'ready' }
            break
        case 'accept-tos':
            rails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    country: 'US',
                    currency: 'USD',
                    status: 'requires-info',
                    blockingActions: ['accept-tos'],
                },
            ]
            nextActions = [{ key: 'accept-tos', kind: 'accept-tos', purpose: 'unlock-bridge' }]
            gateState = { kind: 'accept-tos', userMessage: null }
            break
        case 'fixable-rejection':
            rails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    country: 'US',
                    currency: 'USD',
                    status: 'requires-info',
                    blockingActions: ['bridge-rfi'],
                    reason: { code: 'document_rejected', userMessage: 'upload a clearer photo' },
                },
            ]
            nextActions = [{ key: 'bridge-rfi', kind: 'sumsub', purpose: 'unlock-bridge', levelKey: 'rfi' }]
            gateState = { kind: 'fixable-rejection', userMessage: 'upload a clearer photo' }
            break
        case 'blocked-rejection':
            rails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    country: 'US',
                    currency: 'USD',
                    status: 'blocked',
                    reason: { code: 'final', userMessage: 'contact support' },
                },
            ]
            gateState = { kind: 'blocked-rejection', userMessage: 'contact support' }
            break
        case 'needs-enrollment':
            // identity verified, no bank rail in scope yet (card-only / pool-tier example)
            rails = [
                {
                    id: 'rain.card',
                    provider: 'rain',
                    method: 'CARD',
                    country: 'GLOBAL',
                    currency: 'USD',
                    status: 'enabled',
                },
            ]
            isKycApproved = true
            gateState = { kind: 'needs-enrollment' }
            break
        case 'needs-identity':
            rails = []
            gateState = { kind: 'needs-identity' }
            break
        case 'waiting-on-provider':
            // provider reviewing submitted info (e.g. eea-uplift docs) — user
            // has nothing to do but wait
            rails = [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    country: 'US',
                    currency: 'USD',
                    status: 'requires-info',
                    blockingActions: ['wait:bridge'],
                },
            ]
            gateState = { kind: 'waiting-on-provider', reason: { code: 'bridge_processing' } }
            break
    }

    mockUseCapabilities.mockReturnValue({
        rails,
        nextActions,
        isKycApproved,
        gateFor: () => gateState,
        bankRails: () =>
            rails.filter((r) =>
                ['ACH_US', 'SEPA_EU', 'PIX_BR', 'BANK_TRANSFER_AR', 'SPEI_MX', 'FASTER_PAYMENTS_GB'].includes(r.method)
            ),
        canDo: () => false,
        channelOf: () => null,
    })
}

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    })
}

function renderWithProviders(component: React.ReactElement) {
    const queryClient = createQueryClient()
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>)
}

// ---------- default mock values ----------

function applyDefaults() {
    mockUseAuth.mockReturnValue({
        user: { user: { username: 'test-user', userId: 'user-123' } },
        isFetchingUser: false,
        fetchUser: jest.fn(),
    })

    mockUseWallet.mockReturnValue({
        balance: BigInt(100_000_000), // $100 USDC (6 decimals)
        address: '0xWalletAddress123',
    })

    mockUseKycStatus.mockReturnValue({
        isUserKycApproved: true,
        isUserMantecaKycApproved: true,
    })

    // default: Bridge gate ready (enabled rail). Per-test override via setGate().
    setGate('ready')

    mockUseCurrency.mockReturnValue({
        isLoading: false,
        symbol: 'ARS',
        price: { buy: 1200, sell: 1250 },
    })

    mockUseExchangeRate.mockReturnValue({
        exchangeRate: 1,
        isLoading: false,
    })

    mockUseCreateOnramp.mockReturnValue({
        createOnramp: jest.fn(),
        isLoading: false,
    })

    mockUseLimitsValidation.mockReturnValue({
        isBlocking: false,
        isWarning: false,
        currency: 'USD',
    })

    mockUseMultiPhaseKycFlow.mockReturnValue({
        handleInitiateKyc: jest.fn(),
        showWrapper: false,
        accessToken: null,
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
        isLoading: false,
    })

    mockUseTosGuard.mockReturnValue({
        guardWithTos: jest.fn(() => false),
        showBridgeTos: false,
        hideTos: jest.fn(),
    })

    mockUseCryptoDepositPolling.mockReturnValue({
        status: 'not_started',
        resetStatus: jest.fn(),
        isResetting: false,
    })

    // Reset onramp flow context
    mockOnrampFlow.error = { showError: false, errorMessage: '' }
    mockOnrampFlow.onrampData = null
    mockOnrampFlow.setError = jest.fn((err) => {
        mockOnrampFlow.error = err
    })
    mockOnrampFlow.setOnrampData = jest.fn((data) => {
        mockOnrampFlow.onrampData = data
    })
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    resetQueryState()
    setParams({})
    applyDefaults()
})

// ============================================================
// GROUP 1: Landing / Method Selection
// ============================================================
describe('GROUP 1: Landing / Method Selection', () => {
    test('default view shows Crypto and Bank Transfer options', () => {
        renderWithProviders(<AddMoneyPage />)

        expect(screen.getByText('Crypto')).toBeInTheDocument()
        expect(screen.getByText('Bank Transfer')).toBeInTheDocument()
        expect(screen.getByText('Add Money')).toBeInTheDocument()
    })

    test('clicking Crypto opens the network drawer', () => {
        renderWithProviders(<AddMoneyPage />)

        const cryptoCard = screen.getByTestId('action-card-crypto')
        fireEvent.click(cryptoCard)

        expect(screen.getByTestId('choose-network-drawer')).toBeInTheDocument()
    })

    test('selecting EVM network navigates to crypto page', () => {
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('action-card-crypto'))
        fireEvent.click(screen.getByTestId('select-evm'))

        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/crypto?network=EVM')
    })

    test('clicking Bank Transfer switches to country list', () => {
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('action-card-bank-transfer'))

        // The mock for nuqs useQueryState will be called via setMethod('bank')
        // and then the component should render the country list
        expect(mockSetQueryState).toHaveBeenCalled()
    })

    test('method=bank shows country list', () => {
        resetQueryState({ method: 'bank' })
        renderWithProviders(<AddMoneyPage />)

        expect(screen.getByTestId('country-list')).toBeInTheDocument()
        expect(screen.getByText('Select your country')).toBeInTheDocument()
    })

    // TASK-20033: picking a bank-supported country skips the redundant per-country
    // method list and goes straight to the deposit screen (Manteca for AR/BR,
    // Bridge bank otherwise). Coming-soon countries keep the per-country screen.
    test('selecting a Manteca country (AR/BR) goes straight to the manteca deposit', () => {
        resetQueryState({ method: 'bank' })
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('country-argentina'))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/argentina/manteca')
    })

    test('selecting a Bridge-supported country goes straight to the bank deposit', () => {
        resetQueryState({ method: 'bank' })
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('country-germany'))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')
    })

    test('selecting a coming-soon country keeps the per-country method screen', () => {
        resetQueryState({ method: 'bank' })
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('country-chad'))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/chad')
    })

    test('back from method selection navigates to /home', () => {
        renderWithProviders(<AddMoneyPage />)

        fireEvent.click(screen.getByTestId('nav-header'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })
})

// ============================================================
// GROUP 2: Country Page (method list for a given country)
// ============================================================
describe('GROUP 2: Country Page', () => {
    test('renders AddWithdrawCountriesList with flow=add', () => {
        setParams({ country: 'argentina' })
        renderWithProviders(<AddMoneyCountryPage />)

        expect(screen.getByTestId('add-withdraw-countries-list')).toBeInTheDocument()
        expect(screen.getByText('Flow: add')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 3: Crypto Deposit
// ============================================================
describe('GROUP 3: Crypto Deposit', () => {
    test('loading state shows PeanutLoading', () => {
        resetQueryState({ network: 'EVM' })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={undefined}
                isLoading={true}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    test('loaded EVM deposit shows QR code and address', () => {
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'not_started',
            resetStatus: jest.fn(),
            isResetting: false,
        })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={{
                    depositAddress: '0x1234567890abcdef1234567890abcdef12345678',
                    minDepositLimitUsd: 5,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isLoading={false}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('qr-code')).toBeInTheDocument()
        expect(screen.getByText('Deposit Crypto')).toBeInTheDocument()
        expect(screen.getAllByText(/EVM/).length).toBeGreaterThan(0)
        expect(screen.getByText('5 USD')).toBeInTheDocument()
        expect(screen.getByText('10,000 USD')).toBeInTheDocument()
    })

    test('deposit processing shows CyclingLoading', () => {
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'loading',
            resetStatus: jest.fn(),
            isResetting: false,
        })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={{
                    depositAddress: '0x1234567890abcdef',
                    minDepositLimitUsd: 5,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isLoading={false}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('cycling-loading')).toBeInTheDocument()
    })

    test('deposit failed shows error card with retry button', () => {
        const mockResetStatus = jest.fn()
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'failed',
            resetStatus: mockResetStatus,
            isResetting: false,
        })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={{
                    depositAddress: '0x1234567890abcdef',
                    minDepositLimitUsd: 5,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isLoading={false}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('Oops! Market moved')).toBeInTheDocument()
        expect(screen.getByText('Try Again')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Try Again'))
        expect(mockResetStatus).toHaveBeenCalled()
    })

    test('How to Deposit button opens modal', () => {
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'not_started',
            resetStatus: jest.fn(),
            isResetting: false,
        })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={{
                    depositAddress: '0x1234567890abcdef',
                    minDepositLimitUsd: 5,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isLoading={false}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        fireEvent.click(screen.getByText('How to Deposit'))
        expect(screen.getByTestId('how-to-deposit-modal')).toBeInTheDocument()
    })

    test('warning info card is present for supported networks', () => {
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'not_started',
            resetStatus: jest.fn(),
            isResetting: false,
        })

        renderWithProviders(
            <CryptoDepositView
                network="EVM"
                depositAddressData={{
                    depositAddress: '0x1234567890abcdef',
                    minDepositLimitUsd: 5,
                    maxDepositLimitUsd: 10000,
                    supportedChains: [],
                }}
                isLoading={false}
                onSuccess={jest.fn()}
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('Send to supported networks only')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 4: Crypto Page (full page with success transition)
// ============================================================
describe('GROUP 4: Crypto Page (with success)', () => {
    beforeEach(() => {
        resetQueryState({ network: 'EVM' })
    })

    test('renders CryptoDepositView when not in success state', () => {
        mockRhinoApi.createDepositAddress.mockResolvedValue({
            depositAddress: '0xDepositAddress123',
            minDepositLimitUsd: 5,
            maxDepositLimitUsd: 10000,
        })

        renderWithProviders(<AddMoneyCryptoPage />)

        // The component renders CryptoDepositView which shows Deposit Crypto
        expect(screen.getByText('Deposit Crypto')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 4b: Offramp migration — required handle gate
// ============================================================
describe('GROUP 4b: Offramp migration handle gate', () => {
    const authWithHandle = (offrampHandle: string | null) => {
        mockUseAuth.mockReturnValue({
            user: { user: { username: 'test-user', userId: 'user-123', offrampHandle } },
            isFetchingUser: false,
            fetchUser: jest.fn().mockResolvedValue(null),
        })
    }

    beforeEach(() => {
        resetQueryState({ network: 'EVM', source: 'offramp' })
        mockUseCryptoDepositPolling.mockReturnValue({
            status: 'not_started',
            resetStatus: jest.fn(),
            isResetting: false,
        })
        mockRhinoApi.createDepositAddress.mockResolvedValue({
            depositAddress: '0xDepositAddress123',
            minDepositLimitUsd: 5,
            maxDepositLimitUsd: 10000,
        })
    })

    test('migrant without a stored handle must enter it before seeing the deposit address', () => {
        authWithHandle(null)
        renderWithProviders(<AddMoneyCryptoPage />)

        expect(screen.getByPlaceholderText('Offramp username or email')).toBeInTheDocument()
        expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
    })

    test('submitting the handle saves it trimmed and reveals the deposit screen', async () => {
        authWithHandle(null)
        mockUpdateUserById.mockResolvedValue({ data: {} })
        renderWithProviders(<AddMoneyCryptoPage />)

        fireEvent.change(screen.getByPlaceholderText('Offramp username or email'), {
            target: { value: '  alice@offramp.xyz  ' },
        })
        fireEvent.click(screen.getByText('Continue'))

        await waitFor(() => {
            expect(mockUpdateUserById).toHaveBeenCalledWith({
                userId: 'user-123',
                offrampHandle: 'alice@offramp.xyz',
            })
        })
        await waitFor(() => {
            expect(screen.queryByPlaceholderText('Offramp username or email')).not.toBeInTheDocument()
        })
    })

    test('save failure keeps the gate up and shows an error', async () => {
        authWithHandle(null)
        mockUpdateUserById.mockResolvedValue({ error: 'boom' })
        renderWithProviders(<AddMoneyCryptoPage />)

        fireEvent.change(screen.getByPlaceholderText('Offramp username or email'), {
            target: { value: 'alice@offramp.xyz' },
        })
        fireEvent.click(screen.getByText('Continue'))

        await waitFor(() => {
            expect(screen.getByText(/Could not save your Offramp account/)).toBeInTheDocument()
        })
        expect(screen.getByPlaceholderText('Offramp username or email')).toBeInTheDocument()
    })

    test('migrant with a stored handle goes straight to the deposit screen', () => {
        authWithHandle('alice@offramp.xyz')
        renderWithProviders(<AddMoneyCryptoPage />)

        expect(screen.queryByPlaceholderText('Offramp username or email')).not.toBeInTheDocument()
        expect(screen.getAllByText('Migrate from Offramp').length).toBeGreaterThan(0)
    })
})

// ============================================================
// GROUP 5: Bridge Bank Onramp (SEPA / US / UK / MX)
// ============================================================
describe('GROUP 5: Bridge Bank Onramp', () => {
    beforeEach(() => {
        setParams({ country: 'germany' })
        resetQueryState({ step: 'inputAmount', amount: '' })
        setGate('ready')
    })

    test('inputAmount step shows amount input and Continue button', () => {
        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByText('How much do you want to add?')).toBeInTheDocument()
        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeInTheDocument()
    })

    test('Continue disabled when no amount entered', () => {
        renderWithProviders(<OnrampBankPage />)

        const continueButton = screen.getByText('Continue')
        expect(continueButton).toBeDisabled()
    })

    test('unknown country shows EmptyState', () => {
        setParams({ country: 'narnia' })
        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByTestId('empty-state')).toBeInTheDocument()
        expect(screen.getByText('Country not found')).toBeInTheDocument()
    })

    test('fresh user needs KYC before Bridge deposit confirmation', async () => {
        mockUseKycStatus.mockReturnValue({
            isUserKycApproved: false,
            isUserMantecaKycApproved: false,
        })
        setGate('needs-identity')
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        const continueButton = screen.getByText('Continue')
        await act(async () => {
            fireEvent.click(continueButton)
        })

        expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
    })

    test('KYC approved shows confirmation modal on Continue', async () => {
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        const continueButton = screen.getByText('Continue')
        await act(async () => {
            fireEvent.click(continueButton)
        })

        expect(screen.getByTestId('onramp-confirmation-modal')).toBeInTheDocument()
    })

    test('confirmation modal confirm creates onramp and navigates to showDetails', async () => {
        const mockCreateOnramp = jest.fn().mockResolvedValue({
            transferId: 'transfer-123',
            depositInstructions: {
                amount: '100',
                currency: 'EUR',
                depositMessage: 'REF1234567890',
                bankName: 'Deutsche Bank',
                bankAddress: 'Frankfurt, Germany',
                iban: 'DE89370400440532013000',
                bic: 'COBADEFFXXX',
                accountHolderName: 'Peanut Protocol',
            },
        })
        mockUseCreateOnramp.mockReturnValue({
            createOnramp: mockCreateOnramp,
            isLoading: false,
        })
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        // Click Continue
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        // Click Confirm in modal
        await act(async () => {
            fireEvent.click(screen.getByTestId('confirm-onramp'))
        })

        expect(mockCreateOnramp).toHaveBeenCalled()
        expect(mockSetQueryState).toHaveBeenCalledWith(expect.objectContaining({ step: 'showDetails' }))
    })

    test('onramp error displays ErrorAlert', async () => {
        const mockCreateOnramp = jest.fn().mockRejectedValue(new Error('Service unavailable'))
        // the page must surface the caught error's message directly — the hook
        // exposes no error state to read (that channel was the stale-closure trap).
        mockUseCreateOnramp.mockReturnValue({
            createOnramp: mockCreateOnramp,
            isLoading: false,
        })
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        // Click Continue
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        // Click Confirm in modal
        await act(async () => {
            fireEvent.click(screen.getByTestId('confirm-onramp'))
        })

        // the caught message must be shown to the user
        expect(mockOnrampFlow.setError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: 'Service unavailable',
        })
    })

    test('waiting-on-provider gate shows the reverification pending modal instead of a dead button', async () => {
        setGate('waiting-on-provider')
        const mockCreateOnramp = jest.fn()
        mockUseCreateOnramp.mockReturnValue({
            createOnramp: mockCreateOnramp,
            isLoading: false,
        })
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        // no doomed transfer attempt; the user sees the bridge-review pending modal
        expect(mockCreateOnramp).not.toHaveBeenCalled()
        expect(await screen.findByText(/reviewing your details/i)).toBeInTheDocument()
    })

    test('limits blocking disables Continue and shows LimitsWarningCard', () => {
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
        resetQueryState({ step: 'inputAmount', amount: '50000' })

        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('showDetails step with onrampData shows AddMoneyBankDetails', () => {
        mockOnrampFlow.onrampData = {
            transferId: 'transfer-123',
            depositInstructions: {
                amount: '100',
                currency: 'EUR',
                depositMessage: 'REF1234567890',
                bankName: 'Deutsche Bank',
            },
        }
        resetQueryState({ step: 'showDetails', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByTestId('add-money-bank-details')).toBeInTheDocument()
    })

    test('showDetails step without onrampData redirects to inputAmount', () => {
        resetQueryState({ step: 'showDetails', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        // Without onrampData.transferId, useEffect redirects to inputAmount
        expect(mockSetQueryState).toHaveBeenCalledWith(expect.objectContaining({ step: 'inputAmount' }))
    })

    test('Bridge TOS guard shows TOS step', async () => {
        setGate('accept-tos')
        mockUseTosGuard.mockReturnValue({
            guardWithTos: jest.fn(() => true),
            showBridgeTos: true,
            hideTos: jest.fn(),
        })
        resetQueryState({ step: 'inputAmount', amount: '100' })

        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByTestId('bridge-tos-step')).toBeInTheDocument()
    })

    test('loading state when user is null and no step', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            isFetchingUser: true,
            fetchUser: jest.fn(),
        })
        resetQueryState({})

        renderWithProviders(<OnrampBankPage />)

        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 6: US Bank Page (static route)
// ============================================================
describe('GROUP 6: US Bank Page', () => {
    test('renders AddMoneyBankDetails with flow=add-money', () => {
        const USBankPage = require('../us/bank/page').default
        renderWithProviders(<USBankPage />)

        expect(screen.getByTestId('add-money-bank-details')).toBeInTheDocument()
        expect(screen.getByText('Bank Details (flow: add-money)')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 7: Manteca Deposit (AR, BR)
// ============================================================
describe('GROUP 7: Manteca Deposit (Regional Method)', () => {
    afterEach(() => {
        // reset the per-currency outage list so its default value can't leak between tests
        underMaintenanceConfig.disabledMantecaCurrencies = []
    })

    test('AR + manteca renders MantecaAddMoney when its currency (ARS) is live', () => {
        underMaintenanceConfig.disabledMantecaCurrencies = ['BRL'] // BRL down, ARS live
        setParams({ country: 'argentina', 'regional-method': 'manteca' })
        renderWithProviders(<AddMoneyRegionalMethodPage />)

        expect(screen.getByTestId('manteca-add-money')).toBeInTheDocument()
    })

    test('AR + manteca shows the outage screen when ARS is in the disabled list', () => {
        underMaintenanceConfig.disabledMantecaCurrencies = ['ARS']
        setParams({ country: 'argentina', 'regional-method': 'manteca' })
        renderWithProviders(<AddMoneyRegionalMethodPage />)

        expect(screen.getByTestId('manteca-transfers-maintenance')).toBeInTheDocument()
        expect(screen.queryByTestId('manteca-add-money')).not.toBeInTheDocument()
    })

    test('unsupported country + manteca renders nothing', () => {
        setParams({ country: 'germany', 'regional-method': 'manteca' })
        const { container } = renderWithProviders(<AddMoneyRegionalMethodPage />)

        expect(container.innerHTML).toBe('')
    })

    test('unsupported regional method renders nothing', () => {
        setParams({ country: 'argentina', 'regional-method': 'stripe' })
        const { container } = renderWithProviders(<AddMoneyRegionalMethodPage />)

        expect(container.innerHTML).toBe('')
    })
})

// ============================================================
// GROUP 8: InputAmountStep Component (shared by Manteca + Bridge)
// ============================================================
describe('GROUP 8: InputAmountStep Component', () => {
    // Test InputAmountStep directly — it's the shared sub-component
    // used by both MantecaAddMoney and OnrampBankPage
    let InputAmountStep: React.ComponentType<any>

    beforeAll(() => {
        // Unmock InputAmountStep (it was not explicitly mocked, so just require)
        InputAmountStep = require('@/components/AddMoney/components/InputAmountStep').default
    })

    test('renders amount input, title, and Continue button', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount=""
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('How much do you want to add?')).toBeInTheDocument()
        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeInTheDocument()
    })

    test('Continue disabled when no amount', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount=""
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('Continue enabled with valid amount', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('Continue')).not.toBeDisabled()
    })

    test('renders maintenanceBanner and keeps Continue enabled (warn-only)', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
                maintenanceBanner={<div data-testid="pix-maintenance">PIX deposits are under maintenance</div>}
            />
        )

        expect(screen.getByTestId('pix-maintenance')).toBeInTheDocument()
        // warn-only: the banner is informational and must not block submission
        expect(screen.getByText('Continue')).not.toBeDisabled()
    })

    test('Continue disabled when limits blocking', () => {
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Limit exceeded',
        })

        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: true, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByText('Continue')).toBeDisabled()
        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
    })

    test('error shown when error prop set and limits not blocking', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount="0.01"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error="Deposit amount must be at least $1"
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('error-alert')).toBeInTheDocument()
        expect(screen.getByText('Deposit amount must be at least $1')).toBeInTheDocument()
    })

    test('error hidden when limits blocking (even if error prop set)', () => {
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Limit exceeded',
        })

        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error="Some error"
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: true, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument()
    })

    test('loading state shows loading button', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={true}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        // Button should be disabled when loading
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('currency data loading shows PeanutLoading', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount=""
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                currencyData={{ isLoading: true, symbol: null, price: null }}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    // Regression for PEANUT-UI-PS7: a failed FX fetch leaves price=null while
    // isLoading=false. The old `currencyData.price!.buy` derefed null and crashed
    // the whole render (Next.js page crash). It must now render an error and
    // disable Continue instead of throwing.
    test('rate fetch failure renders error and disables Continue (no crash)', () => {
        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                currencyData={{ isLoading: false, isError: true, symbol: null, price: null }}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        expect(screen.getByTestId('error-alert')).toBeInTheDocument()
        expect(
            screen.getByText('Exchange rates are temporarily unavailable. Please try again in a moment.')
        ).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('onSubmit called when Continue clicked', async () => {
        const onSubmit = jest.fn()
        renderWithProviders(
            <InputAmountStep
                tokenAmount="100"
                setTokenAmount={jest.fn()}
                onSubmit={onSubmit}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                limitsValidation={{ isBlocking: false, isWarning: false, currency: 'USD' }}
                limitsCurrency="USD"
                onBack={jest.fn()}
            />
        )

        await act(async () => {
            fireEvent.click(screen.getByText('Continue'))
        })

        expect(onSubmit).toHaveBeenCalled()
    })
})
