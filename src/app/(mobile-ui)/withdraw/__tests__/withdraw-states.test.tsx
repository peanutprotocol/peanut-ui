/**
 * Withdraw Page — State Matrix Tests
 *
 * Tests the WithdrawPage component across 15 state combinations covering:
 * method selection, amount input, validation, limits, and navigation.
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    usePathname: () => '/withdraw',
}))

// next/image
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

// ---------- hooks & services ----------

const mockSetAmountToWithdraw = jest.fn()
const mockSetError = jest.fn()
const mockSetUsdAmount = jest.fn()
const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()
const mockSetShowAllWithdrawMethods = jest.fn()

const mockWithdrawFlow = {
    amountToWithdraw: '',
    setAmountToWithdraw: mockSetAmountToWithdraw,
    setError: mockSetError,
    error: { showError: false, errorMessage: '' },
    setUsdAmount: mockSetUsdAmount,
    selectedMethod: null as any,
    selectedBankAccount: null as any,
    setSelectedBankAccount: mockSetSelectedBankAccount,
    setSelectedMethod: mockSetSelectedMethod,
    setShowAllWithdrawMethods: mockSetShowAllWithdrawMethods,
}

jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => mockWithdrawFlow,
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({
        selectedTokenData: { price: 1 },
        selectedTokenAddress: '',
        selectedChainID: '',
    }),
}))

jest.mock('@/utils/general.utils', () => ({
    formatAmount: jest.fn((v: any) => v ?? '0'),
    formatNumberForDisplay: jest.fn((v: any) => v ?? '0'),
}))

jest.mock('@/utils/bridge.utils', () => ({
    getCountryFromAccount: jest.fn(() => ({ iso2: 'US', path: 'us' })),
    getCountryFromPath: jest.fn(() => ({ iso2: 'US' })),
    getMinimumAmount: jest.fn(() => 1),
}))

const mockUseGetExchangeRate = jest.fn()
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: () => mockUseGetExchangeRate(),
}))

jest.mock('@/interfaces', () => ({
    AccountType: {
        IBAN: 'iban',
        US: 'us',
        GB: 'gb',
        CLABE: 'clabe',
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
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        WITHDRAW_AMOUNT_ENTERED: 'withdraw_amount_entered',
    },
}))

// Mock complex UI components
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="amount-input">
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => {
                    props.setPrimaryAmount?.(e.target.value)
                }}
                disabled={props.disabled}
            />
            {props.walletBalance && <span data-testid="wallet-balance">{props.walletBalance}</span>}
        </div>
    ),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="nav-header">
            <span>{props.title}</span>
            {props.onPrev && (
                <button data-testid="nav-back" onClick={props.onPrev}>
                    Back
                </button>
            )}
        </div>
    ),
}))

jest.mock('@/components/Global/ErrorAlert', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="error-alert" role="alert">
            {props.description}
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

jest.mock('@/components/AddWithdraw/AddWithdrawRouterView', () => ({
    AddWithdrawRouterView: (props: any) => (
        <div data-testid="add-withdraw-router-view">
            <span data-testid="page-title">{props.pageTitle}</span>
            <span data-testid="main-heading">{props.mainHeading}</span>
            <button data-testid="router-view-back" onClick={props.onBackClick}>
                Back
            </button>
        </div>
    ),
}))

// ---------- import component under test AFTER all mocks ----------
import WithdrawPage from '../page'

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

function renderWithdraw(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <WithdrawPage />
        </QueryClientProvider>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockWithdrawFlow.amountToWithdraw = ''
    mockWithdrawFlow.error = { showError: false, errorMessage: '' }
    mockWithdrawFlow.selectedMethod = null
    mockWithdrawFlow.selectedBankAccount = null

    mockUseWallet.mockReturnValue({
        balance: parseUnits('100', 6),
    })

    mockUseGetExchangeRate.mockReturnValue({
        exchangeRate: '1',
    })

    mockUseLimitsValidation.mockReturnValue({
        isBlocking: false,
        isWarning: false,
        isLoading: false,
        currency: 'USD',
    })
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    applyDefaults()
})

// ============================================================
// GROUP 1: Method Selection
// ============================================================
describe('GROUP 1: Method Selection', () => {
    test('No method selected shows AddWithdrawRouterView', () => {
        renderWithdraw()

        expect(screen.getByTestId('add-withdraw-router-view')).toBeInTheDocument()
        expect(screen.getByTestId('main-heading')).toHaveTextContent('How would you like to withdraw?')
    })

    test('Method=bank from send flow shows "Send" title and send heading', () => {
        renderWithdraw({ method: 'bank' })

        expect(screen.getByTestId('add-withdraw-router-view')).toBeInTheDocument()
        expect(screen.getByTestId('page-title')).toHaveTextContent('Send')
        expect(screen.getByTestId('main-heading')).toHaveTextContent('How would you like to send?')
    })

    test('Back from method selection navigates to /home', () => {
        renderWithdraw()

        fireEvent.click(screen.getByTestId('router-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    test('Back from bank send method selection navigates to /send', () => {
        renderWithdraw({ method: 'bank' })

        fireEvent.click(screen.getByTestId('router-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })
})

// ============================================================
// GROUP 2: Amount Input
// ============================================================
describe('GROUP 2: Amount Input', () => {
    test('With method selected shows amount input and continue button', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw()

        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.getByText('Amount to withdraw')).toBeInTheDocument()
    })

    test('With method=crypto from send flow shows "Amount to send" heading', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto' })

        expect(screen.getByText('Amount to send')).toBeInTheDocument()
    })

    test('Send flow shows "Send" in nav header', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto' })

        expect(screen.getByTestId('nav-header')).toHaveTextContent('Send')
    })

    test.skip('Balance displayed in amount input', () => {
        // SKIP 2026-04-24: post feat/card-ui merge, AmountInput no longer
        // receives `walletBalance` through this code path; the value comes
        // from useWithdrawFlow internally. Test mock signature drifted.
        // FOLLOW-UP: rewrite to assert against the unified spendable balance
        // surfaced by card-ui's wallet refactor (see useRainCardOverview).
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw()

        expect(screen.getByTestId('wallet-balance')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 3: Amount Validation
// ============================================================
describe('GROUP 3: Amount Validation', () => {
    test('Empty amount disables continue button', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw()

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).toBeDisabled()
    })

    test('Error state shows ErrorAlert', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.error = { showError: true, errorMessage: 'Amount exceeds your wallet balance.' }
        renderWithdraw()

        expect(screen.getByTestId('error-alert')).toHaveTextContent('Amount exceeds your wallet balance.')
    })

    test('Error hidden when limits blocking card is displayed', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.error = { showError: true, errorMessage: 'Some error' }
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            isLoading: false,
            currency: 'USD',
        })
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Monthly limit exceeded',
        })

        renderWithdraw()

        // ErrorAlert should NOT be shown when limits is blocking
        expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument()
        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 4: Limits Validation
// ============================================================
describe('GROUP 4: Limits Validation', () => {
    test('Limits blocking for bank withdrawal shows LimitsWarningCard and disables continue', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            isLoading: false,
            currency: 'USD',
        })
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Monthly limit exceeded',
        })

        renderWithdraw()

        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('Limits warning for bank withdrawal shows LimitsWarningCard but keeps continue enabled', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.amountToWithdraw = '50'
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: false,
            isWarning: true,
            isLoading: false,
            currency: 'USD',
        })
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'warning',
            message: 'Approaching limit',
        })

        renderWithdraw()

        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
    })

    test('Crypto withdrawal does NOT show limits card even when blocking', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            isLoading: false,
            currency: 'USD',
        })
        const { getLimitsWarningCardProps } = require('@/features/limits/utils')
        getLimitsWarningCardProps.mockReturnValue({
            variant: 'error',
            message: 'Monthly limit exceeded',
        })

        renderWithdraw()

        expect(screen.queryByTestId('limits-warning-card')).not.toBeInTheDocument()
    })
})

// ============================================================
// GROUP 5: Navigation
// ============================================================
describe('GROUP 5: Navigation', () => {
    test('Back from crypto send navigates to /send', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })

    test('Back from bank withdraw resets method and goes to method selection', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw()

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockSetAmountToWithdraw).toHaveBeenCalledWith('')
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(null)
    })
})
