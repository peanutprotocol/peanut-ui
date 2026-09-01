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

const mockSetAmountToWithdraw = jest.fn()
const mockSetError = jest.fn()
const mockSetUsdAmount = jest.fn()
const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()
const mockSetShowAllWithdrawMethods = jest.fn()
const mockSetIsMaxWithdrawal = jest.fn()

const mockWithdrawFlow = {
    amountToWithdraw: '',
    setAmountToWithdraw: mockSetAmountToWithdraw,
    isMaxWithdrawal: false,
    setIsMaxWithdrawal: mockSetIsMaxWithdrawal,
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
            {!!props.balanceFillAmount && (
                <button
                    data-testid="use-full-balance"
                    data-fill={String(props.balanceFillAmount)}
                    onClick={() => {
                        // real component floors to cents, then reports both ways
                        const filled = (Math.floor(props.balanceFillAmount * 100) / 100).toString()
                        props.onBalanceFilled?.(filled)
                        props.setPrimaryAmount?.(filled)
                    }}
                >
                    Use full balance
                </button>
            )}
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
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <WithdrawPage />
            </QueryClientProvider>
        </IntlWrapper>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockWithdrawFlow.amountToWithdraw = ''
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

    // The exchange-rate widget's "Try it!" CTA lands here for users with a
    // balance; back used to reset to /home instead of the widget they came from.
    test('Back honours ?returnTo when the flow was entered from another screen', () => {
        renderWithdraw({ returnTo: '/profile/exchange-rate?from=USD&to=EUR' })

        fireEvent.click(screen.getByTestId('router-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate?from=USD&to=EUR')
        expect(mockRouterPush).not.toHaveBeenCalledWith('/home')
    })

    test('Back ignores an off-origin ?returnTo and still resets to /home', () => {
        renderWithdraw({ returnTo: 'https://evil.example/phish' })

        fireEvent.click(screen.getByTestId('router-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    test('Back from the send flow still goes to /send, ignoring ?returnTo', () => {
        renderWithdraw({ method: 'bank', returnTo: '/profile/exchange-rate' })

        fireEvent.click(screen.getByTestId('router-view-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
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
        mockWithdrawFlow.error = { showError: true, errorMessage: 'Not enough balance. Add funds to continue.' }
        renderWithdraw()

        expect(screen.getByTestId('error-alert')).toHaveTextContent('Not enough balance. Add funds to continue.')
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

    test('Crypto withdrawal has no amount-step minimum (parity with send-via-link)', () => {
        // Regression: the shared amount step applied the bank $1 minimum to
        // crypto (getMinimumAmount('') → 1), blocking sub-$1 on-chain sends
        // that send-via-link already allows. Same-chain Arbitrum withdrawals
        // have no minimum at all; Rhino's per-network bridge minimums are
        // enforced at review time, once the destination is known.
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockWithdrawFlow.amountToWithdraw = '0.4'

        renderWithdraw()

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).not.toBeDisabled()

        fireEvent.click(continueBtn)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto')
    })

    test('Crypto send forwards the send marker to the next step', () => {
        // `?method=` is the ONLY send-vs-withdraw signal. Drop it on this hop and
        // every screen after the amount step reverts to withdraw copy — the user
        // picks "Send -> Exchange or Wallet" and the next screen says
        // "You're withdrawing". Losing it here is the original bug.
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockWithdrawFlow.amountToWithdraw = '25'

        renderWithdraw({ method: 'crypto' })

        fireEvent.click(screen.getByText('Continue'))
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?method=crypto')
    })

    test('Bank withdrawal keeps the $1 minimum for sub-$1 amounts', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.amountToWithdraw = '0.5'

        renderWithdraw()

        expect(screen.getByText('Continue')).toBeDisabled()
        // validation is debounced 300ms behind typing
        await waitFor(() =>
            expect(mockSetError).toHaveBeenCalledWith({
                showError: true,
                errorMessage: 'Minimum withdrawal is $1.',
            })
        )
    })

    test('Marks the amount as a max withdrawal, and unmarks it on any edit', () => {
        // The flag is what lets the crypto path settle the sub-cent remainder
        // the displayed 2 decimals leave behind (TASK-21899).
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('12.345678', 6),
            formattedSpendableBalance: '12.34',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 12.345678,
        })

        renderWithdraw()

        fireEvent.click(screen.getByTestId('use-full-balance'))
        expect(mockSetIsMaxWithdrawal).toHaveBeenLastCalledWith(true)

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '5' } })
        expect(mockSetIsMaxWithdrawal).toHaveBeenLastCalledWith(false)
    })

    test('Hands down the full-precision balance while the field shows cents', () => {
        // The page passes the number its own validation compares against, not
        // the rounded label; the input is what floors it for display, and the
        // crypto path recovers the remainder from the flag (TASK-21899).
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('12.345678', 6),
            formattedSpendableBalance: '12.34',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 12.345678,
        })

        renderWithdraw()
        expect(screen.getByTestId('use-full-balance')).toHaveAttribute('data-fill', '12.345678')

        fireEvent.click(screen.getByTestId('use-full-balance'))

        expect(screen.getByTestId('amount-field')).toHaveValue('12.34')
        expect(screen.getByText('Continue')).not.toBeDisabled()
    })

    test('Full balance passes validation and continues with that amount', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }

        renderWithdraw()
        fireEvent.click(screen.getByTestId('use-full-balance'))

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).not.toBeDisabled()

        fireEvent.click(continueBtn)
        expect(mockSetAmountToWithdraw).toHaveBeenCalledWith('100')
    })

    test('Full balance below the method minimum keeps Continue disabled', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('0.5', 6),
            formattedSpendableBalance: '0.50',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 0.5,
        })

        renderWithdraw()
        fireEvent.click(screen.getByTestId('use-full-balance'))

        expect(screen.getByText('Continue')).toBeDisabled()
        await waitFor(() =>
            expect(mockSetError).toHaveBeenCalledWith({
                showError: true,
                errorMessage: 'Minimum withdrawal is $1.',
            })
        )
    })

    test('No fill action while the balance is still loading', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseWallet.mockReturnValue({
            spendableBalance: undefined,
            formattedSpendableBalance: '0.00',
            hasSufficientSpendableBalance: () => false,
        })

        renderWithdraw()

        expect(screen.queryByTestId('use-full-balance')).not.toBeInTheDocument()
        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('Stale bank method entering via ?method=crypto keeps the bank minimum', () => {
        // Regression: the crypto exemption must follow selectedMethod (the
        // routing source of truth), not the URL param. A leftover bank method
        // from an abandoned withdraw survives in the app-wide context and
        // still routes Continue to the bank flow — so sub-$1 must stay blocked.
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.amountToWithdraw = '0.5'

        renderWithdraw({ method: 'crypto' })

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

        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('100', 6),
            formattedSpendableBalance: '100.00',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 100,
        })
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockWithdrawFlow.selectedBankAccount = { type: 'iban', details: { countryName: '', countryCode: '' } }
        mockWithdrawFlow.amountToWithdraw = '50'

        renderWithdraw()

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
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('100', 6),
            formattedSpendableBalance: '100.00',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 100,
        })
        mockWithdrawFlow.selectedMethod = { type: 'manteca', countryPath: 'argentina', title: 'Bank Transfer' }
        mockWithdrawFlow.selectedBankAccount = { type: 'manteca', details: { countryName: 'argentina' } }
        mockWithdrawFlow.amountToWithdraw = '50'

        renderWithdraw()

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
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <WithdrawPage />
                </QueryClientProvider>
            </IntlWrapper>
        )

        // synchronously after the re-render — no awaiting a second import
        expect(isHidden(screen.getByTestId('native-bank-view'))).toBe(false)
        expect(mockBankViewMounts).toHaveBeenCalledTimes(1)
    })
})
