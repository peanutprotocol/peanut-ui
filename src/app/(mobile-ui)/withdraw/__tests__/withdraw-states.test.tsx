/**
 * Withdraw Page — State Matrix Tests
 *
 * Tests the root withdraw flow (WithdrawRoot on the URL stepper) across
 * method selection, amount input, validation, limits, navigation, and the
 * native (?country=…) sub-views.
 *
 * Strategy: mock hooks/services at the module level; run the REAL stepper and
 * flow hook against the nuqs testing adapter, so the URL contract
 * (?step=amount, ?amount=, send marker forwarding) is what's asserted.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
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

const mockSetError = jest.fn()
const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()

const mockWithdrawFlow = {
    error: { showError: false, errorMessage: '' },
    setError: mockSetError,
    selectedMethod: null as any,
    selectedBankAccount: null as any,
    setSelectedBankAccount: mockSetSelectedBankAccount,
    setSelectedMethod: mockSetSelectedMethod,
}

jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => mockWithdrawFlow,
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

jest.mock('@/utils/general.utils', () => ({
    formatAmount: jest.fn((v: any) => v ?? '0'),
    formatNumberForDisplay: jest.fn((v: any) => v ?? '0'),
    // real implementation: same-origin paths pass, everything else is rejected
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

const mockGetCountryFromAccount = jest.fn(
    () => ({ iso2: 'US', path: 'us' }) as { iso2: string; path: string } | undefined
)
jest.mock('@/utils/bridge.utils', () => ({
    getCountryFromAccount: mockGetCountryFromAccount,
    getCountryFromPath: jest.fn(() => ({ iso2: 'US', id: 'US' })),
    getMinimumAmount: jest.fn(() => 1),
    railJurisdictionForBank: jest.fn(() => 'US'),
}))

const mockUseGetExchangeRate = jest.fn()
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: () => mockUseGetExchangeRate(),
}))

const mockUseLimitsValidation = jest.fn()
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: (...args: any[]) => mockUseLimitsValidation(...args),
}))

jest.mock('@/features/limits/components/LimitsWarningCard', () => ({
    __esModule: true,
    default: (_props: any) => <div data-testid="limits-warning-card" />,
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

// Native (?country=…) views are React.lazy'd. These stubs count mounts so the
// remount regression below can see a torn-down + rebuilt subtree.
const mockBankViewMounts = jest.fn()
jest.mock('../_withdraw-bank', () => {
    const NativeBankView = () => {
        React.useEffect(() => mockBankViewMounts(), [])
        return <div data-testid="native-bank-view" />
    }
    return { __esModule: true, default: NativeBankView }
})

jest.mock('@/components/AddWithdraw/AddWithdrawCountriesList', () => ({
    __esModule: true,
    default: () => <div data-testid="native-countries-list" />,
}))

// The method step's composition (saved accounts / country list) has its own
// suite — here it stands in as a probe for titles + flow wiring.
jest.mock('@/features/withdraw/views/WithdrawMethodView', () => ({
    WithdrawMethodView: (props: any) => (
        <div data-testid="withdraw-method-view">
            <span data-testid="page-title">{props.pageTitle}</span>
            <span data-testid="main-heading">{props.mainHeading}</span>
            <button data-testid="method-view-back" onClick={props.onExit}>
                Back
            </button>
            <button data-testid="method-view-choose" onClick={props.onMethodChosen}>
                Choose
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
        <NuqsTestingAdapter searchParams={params}>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <WithdrawPage />
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsTestingAdapter>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockWithdrawFlow.error = { showError: false, errorMessage: '' }
    mockWithdrawFlow.selectedMethod = null
    mockWithdrawFlow.selectedBankAccount = null

    mockUseWallet.mockReturnValue({
        // component gates on the displayed `spendableBalance` (= maxDecimalAmount).
        spendableBalance: parseUnits('100', 6),
        formattedSpendableBalance: '100.00',
        // amount-aware: over-$100 entries are a true shortfall
        hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 100,
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
    // clearAllMocks() resets call history but not implementations, so restore
    // the default country resolution here — tests that override it (GROUP 6)
    // then don't leak into later tests regardless of order or early failure.
    mockGetCountryFromAccount.mockReturnValue({ iso2: 'US', path: 'us' })
})

// ============================================================
// GROUP 1: Method Selection (?step absent → method step)
// ============================================================
describe('GROUP 1: Method Selection', () => {
    test('No step in the URL shows the method view', () => {
        renderWithdraw()

        expect(screen.getByTestId('withdraw-method-view')).toBeInTheDocument()
        expect(screen.getByTestId('main-heading')).toHaveTextContent('How would you like to withdraw?')
    })

    test('Method=bank from send flow shows "Send" title and send heading', () => {
        renderWithdraw({ method: 'bank' })

        expect(screen.getByTestId('withdraw-method-view')).toBeInTheDocument()
        expect(screen.getByTestId('page-title')).toHaveTextContent('Send')
        expect(screen.getByTestId('main-heading')).toHaveTextContent('How would you like to send?')
    })

    test('?step=amount with no method in flow memory falls back to the method view (guard)', () => {
        // refresh/deep-link into the amount step after the flow memory died —
        // the stepper guard resolves to method selection, never a dead screen
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('withdraw-method-view')).toBeInTheDocument()
        expect(screen.queryByTestId('amount-input')).not.toBeInTheDocument()
    })

    test('Choosing a method advances to the amount step in place', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw()

        fireEvent.click(screen.getByTestId('method-view-choose'))
        expect(await screen.findByTestId('amount-input')).toBeInTheDocument()
    })

    test('Back from method selection navigates to /home', () => {
        renderWithdraw()

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    // The exchange-rate widget's "Try it!" CTA lands here for users with a
    // balance; back used to reset to /home instead of the widget they came from.
    test('Back honours ?returnTo when the flow was entered from another screen', () => {
        renderWithdraw({ returnTo: '/profile/exchange-rate?from=USD&to=EUR' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate?from=USD&to=EUR')
        expect(mockRouterPush).not.toHaveBeenCalledWith('/home')
    })

    test('Back ignores an off-origin ?returnTo and still resets to /home', () => {
        renderWithdraw({ returnTo: 'https://evil.example/phish' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    test('Back from the send flow still goes to /send, ignoring ?returnTo', () => {
        renderWithdraw({ method: 'bank', returnTo: '/profile/exchange-rate' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })

    test('Back from bank send method selection navigates to /send', () => {
        renderWithdraw({ method: 'bank' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })
})

// ============================================================
// GROUP 2: Amount Input (?step=amount)
// ============================================================
describe('GROUP 2: Amount Input', () => {
    test('With method selected shows amount input and continue button', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeInTheDocument()
        expect(screen.getByText('Amount to withdraw')).toBeInTheDocument()
    })

    test('?method=crypto entry lands on the amount step without a step param (send hand-off)', async () => {
        // /withdraw?method=crypto is send's entry URL — the method is implied,
        // so the flow commits it and moves to the amount step by itself
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto' })

        expect(await screen.findByTestId('amount-input')).toBeInTheDocument()
    })

    test('With method=crypto from send flow shows "Amount to send" heading', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto', step: 'amount' })

        expect(screen.getByText('Amount to send')).toBeInTheDocument()
    })

    test('Send flow shows "Send" in nav header', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto', step: 'amount' })

        expect(screen.getByTestId('nav-header')).toHaveTextContent('Send')
    })

    test('The URL amount pre-fills the input (refresh-safe)', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw({ step: 'amount', amount: '42' })

        expect(screen.getByTestId('amount-field')).toHaveValue('42')
    })
})

// ============================================================
// GROUP 3: Amount Validation
// ============================================================
describe('GROUP 3: Amount Validation', () => {
    test('Empty amount disables continue button', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw({ step: 'amount' })

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).toBeDisabled()
    })

    test('Error state shows the error banner', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.error = { showError: true, errorMessage: 'Not enough balance. Add funds to continue.' }
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('error-alert')).toHaveTextContent('Not enough balance. Add funds to continue.')
    })

    test('Error hidden when limits blocking card is displayed (fiat)', () => {
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

        renderWithdraw({ step: 'amount' })

        // the banner yields to the limits card — the card is the one reason shown
        expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument()
        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
    })

    test('Crypto: the balance error stays visible even while limits are blocking (TASK-21666)', () => {
        // Regression: above the off-ramp limit, crypto rendered NOTHING — the
        // limits card never renders for crypto and the banner was suppressed.
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockWithdrawFlow.error = { showError: true, errorMessage: 'Not enough balance. Add funds to continue.' }
        mockUseLimitsValidation.mockReturnValue({
            isBlocking: true,
            isWarning: false,
            isLoading: false,
            currency: 'USD',
        })

        renderWithdraw({ step: 'amount' })

        expect(screen.queryByTestId('limits-warning-card')).not.toBeInTheDocument()
        expect(screen.getByTestId('error-alert')).toHaveTextContent('Not enough balance. Add funds to continue.')
    })

    test('Crypto withdrawal has no amount-step minimum (parity with send-via-link)', () => {
        // Regression: the shared amount step applied the bank $1 minimum to
        // crypto (getMinimumAmount('') → 1), blocking sub-$1 on-chain sends
        // that send-via-link already allows. Same-chain Arbitrum withdrawals
        // have no minimum at all; Rhino's per-network bridge minimums are
        // enforced at review time, once the destination is known.
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }

        renderWithdraw({ step: 'amount', amount: '0.4' })

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).not.toBeDisabled()

        fireEvent.click(continueBtn)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?amount=0.4')
    })

    test('Crypto send forwards the send marker AND the amount to the next step', () => {
        // `?method=` is the ONLY send-vs-withdraw signal, and `?amount=` is the
        // one typed amount — both must survive the hop (TASK-21664/21665).
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }

        renderWithdraw({ method: 'crypto', step: 'amount', amount: '25' })

        fireEvent.click(screen.getByText('Continue'))
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?method=crypto&amount=25')
    })

    test('Manteca method carries the amount into the manteca flow (TASK-21664)', () => {
        mockWithdrawFlow.selectedMethod = { type: 'manteca', countryPath: 'argentina', title: 'Bank Transfer' }

        renderWithdraw({ step: 'amount', amount: '50' })

        fireEvent.click(screen.getByText('Continue'))
        expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('/withdraw/manteca'))
        expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('country=argentina'))
        expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('amount=50'))
    })

    test('Bank withdrawal keeps the $1 minimum for sub-$1 amounts', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }

        renderWithdraw({ step: 'amount', amount: '0.5' })

        expect(screen.getByText('Continue')).toBeDisabled()
        // validation is debounced 300ms behind typing
        await waitFor(() =>
            expect(mockSetError).toHaveBeenCalledWith({
                showError: true,
                errorMessage: 'Minimum withdrawal is $1.',
            })
        )
    })

    test('Stale bank method entering via ?method=crypto keeps the bank minimum', () => {
        // Regression: the crypto exemption must follow selectedMethod (the
        // routing source of truth), not the URL param. A leftover bank method
        // from an abandoned withdraw still routes Continue to the bank flow —
        // so sub-$1 must stay blocked.
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }

        renderWithdraw({ method: 'crypto', step: 'amount', amount: '0.5' })

        expect(screen.getByText('Continue')).toBeDisabled()
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

        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('limits-warning-card')).toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('Limits warning for bank withdrawal shows LimitsWarningCard but keeps continue enabled', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
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

        renderWithdraw({ step: 'amount', amount: '50' })

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

        renderWithdraw({ step: 'amount' })

        expect(screen.queryByTestId('limits-warning-card')).not.toBeInTheDocument()
    })
})

// ============================================================
// GROUP 5: Navigation
// ============================================================
describe('GROUP 5: Navigation', () => {
    test('Back from crypto send navigates to /send', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto', step: 'amount' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })

    test('Back from bank withdraw resets method and account (stepper owns the step)', () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw({ step: 'amount' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(null)
    })
})

// ============================================================
// GROUP 6: Continue must never silently die (regression)
// ============================================================
describe('GROUP 6: Continue never dead-buttons', () => {
    test('Unresolved bank-account country shows an error instead of throwing (dead button)', () => {
        // Regression for the "press Continue, nothing happens" report: when
        // getCountryFromAccount can't resolve a country, the handler used to
        // `throw` inside onClick — aborting the router transition with no UI
        // feedback (Sentry: incomplete-app-router-transaction, 6 users/14d).
        mockGetCountryFromAccount.mockReturnValue(undefined)

        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.selectedBankAccount = { type: 'iban', details: { countryName: '', countryCode: '' } }

        renderWithdraw({ step: 'amount', amount: '50' })

        // Pressing Continue must NOT throw and must NOT navigate...
        expect(() => fireEvent.click(screen.getByText('Continue'))).not.toThrow()
        expect(mockRouterPush).not.toHaveBeenCalled()
        // ...it surfaces a recoverable error instead.
        expect(mockSetError).toHaveBeenCalledWith({
            showError: true,
            errorMessage: "We couldn't determine this account's country. Please contact support.",
        })
    })

    test('Manteca account routes to the Manteca flow, not the bank branch', () => {
        // Manteca (AR/BR) accounts set selectedBankAccount too; the manteca
        // method check must win over the generic bank branch so they reach
        // /withdraw/manteca rather than the Bridge bank page (or the throw).
        mockWithdrawFlow.selectedMethod = { type: 'manteca', countryPath: 'argentina', title: 'Bank Transfer' }
        mockWithdrawFlow.selectedBankAccount = { type: 'manteca', details: { countryName: 'argentina' } }

        renderWithdraw({ step: 'amount', amount: '50' })

        fireEvent.click(screen.getByText('Continue'))
        expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('/withdraw/manteca'))
        expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('country=argentina'))
    })
})

// ============================================================
// GROUP 7: Native sub-views (?country=…) must stay on screen
// ============================================================
describe('GROUP 7: Native sub-view mounting', () => {
    // React.lazy() called inside the render body hands back a fresh, unresolved
    // lazy every time, so each re-render re-suspended: React hid the rendered
    // view and showed the Suspense fallback (null) until the import re-resolved.
    // The user saw the withdraw screen blank and load a second time.
    const isHidden = (el: HTMLElement) => {
        let node: HTMLElement | null = el
        while (node) {
            if (node.style?.display === 'none') return true
            node = node.parentElement
        }
        return false
    }

    test('the lazy bank view survives a re-render without blanking', async () => {
        const { rerender } = renderWithdraw({ country: 'us', view: 'bank' })
        expect(await screen.findByTestId('native-bank-view')).toBeInTheDocument()
        expect(mockBankViewMounts).toHaveBeenCalledTimes(1)

        const queryClient = createQueryClient()
        rerender(
            <NuqsTestingAdapter searchParams={{ country: 'us', view: 'bank' }}>
                <IntlWrapper>
                    <QueryClientProvider client={queryClient}>
                        <WithdrawPage />
                    </QueryClientProvider>
                </IntlWrapper>
            </NuqsTestingAdapter>
        )

        // synchronously after the re-render — no awaiting a second import
        expect(isHidden(screen.getByTestId('native-bank-view'))).toBe(false)
        expect(mockBankViewMounts).toHaveBeenCalledTimes(1)
    })
})
