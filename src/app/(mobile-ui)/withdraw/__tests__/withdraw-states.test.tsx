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
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseUnits } from 'viem'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockRouterBack = jest.fn()
const mockRouterReplace = jest.fn()
const mockSearchParams = new Map<string, string>()

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
const mockSetIsMaxWithdrawal = jest.fn()
const mockSetRecipient = jest.fn()
const mockSetIsValidRecipient = jest.fn()

const mockWithdrawFlow = {
    error: { showError: false, errorMessage: '' },
    setError: mockSetError,
    setIsMaxWithdrawal: mockSetIsMaxWithdrawal,
    selectedMethod: null as any,
    selectedBankAccount: null as any,
    setSelectedBankAccount: mockSetSelectedBankAccount,
    setSelectedMethod: mockSetSelectedMethod,
    setRecipient: mockSetRecipient,
    setIsValidRecipient: mockSetIsValidRecipient,
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
    // real implementation, for the real AmountInput
    formatTokenAmount: (...args: unknown[]) => jest.requireActual('@/utils/general.utils').formatTokenAmount(...args),
    // real implementation: same-origin paths pass, everything else is rejected
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

const mockGetCountryFromAccount = jest.fn(
    () => ({ iso2: 'US', path: 'us' }) as { iso2: string; path: string } | undefined
)
const mockGetOfframpConfigFromAccount = jest.fn(() => ({ currency: 'usd', paymentRail: 'ach' }))
jest.mock('@/utils/bridge.utils', () => ({
    getCountryFromAccount: mockGetCountryFromAccount,
    getOfframpConfigFromAccount: () => mockGetOfframpConfigFromAccount(),
    getCountryFromPath: jest.fn(() => ({ iso2: 'US', id: 'US' })),
    getMinimumAmount: jest.fn(() => 1),
    railJurisdictionForBank: jest.fn(() => 'US'),
}))

// bank amount typed in its currency (TASK-23054): the quote rate the amount step converts with
let mockBankRate: string | null = '0.9'
// the last refresh failed; the hook keeps the last rate
let mockBankRateError = false
jest.mock('@/hooks/useBridgeOfframpQuote', () => ({
    useBridgeOfframpQuote: ({ currency }: { currency: string | null }) => ({
        quote: currency && mockBankRate ? { rate: mockBankRate } : null,
        isFetching: false,
        isError: !!currency && mockBankRateError,
        refetch: jest.fn(),
    }),
}))

const mockUseGetExchangeRate = jest.fn()
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: (args: unknown) => mockUseGetExchangeRate(args),
}))

// the public withdrawal rate behind the shared minimum (fees v2: net of Peanut's margin)
const mockUseOfframpRate = jest.fn()
jest.mock('@/hooks/useOfframpRate', () => ({
    useOfframpRate: (...args: unknown[]) => mockUseOfframpRate(...args),
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
    PEANUT_WALLET_CHAIN: { id: 42161 },
}))

// The token selector's context is app-level; the flow writes the scanned
// destination into it, so the test reads the writes off these mocks.
const mockSetSelectedChainID = jest.fn()
const mockSetSelectedTokenAddress = jest.fn()
const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const mockSupportedChainsAndTokens: Record<string, { chainId: string; tokens: unknown[] }> = {}
jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: jest.requireActual('react').createContext({
        supportedChainsAndTokens: mockSupportedChainsAndTokens,
        setSelectedChainID: (...args: unknown[]) => mockSetSelectedChainID(...args),
        setSelectedTokenAddress: (...args: unknown[]) => mockSetSelectedTokenAddress(...args),
    }),
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        WITHDRAW_AMOUNT_ENTERED: 'withdraw_amount_entered',
    },
}))

// Mock complex UI components. A test that needs the real field's effects (its
// per-render reporting to the flow) sets mockUseRealAmountInput.
let mockUseRealAmountInput = false
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: any) => {
        if (mockUseRealAmountInput) {
            const RealAmountInput = jest.requireActual('@/components/Global/AmountInput').default
            return <RealAmountInput {...props} />
        }
        return (
            <div data-testid="amount-input">
                <input
                    data-testid="amount-field"
                    data-symbol={props.primaryDenomination?.symbol}
                    value={props.initialAmount ?? ''}
                    onChange={(e) => {
                        props.setPrimaryAmount?.(e.target.value)
                        // the real component reports the converted value too
                        props.setSecondaryAmount?.(String(Number(e.target.value) / props.primaryDenomination.price))
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
        )
    },
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
    WithdrawMethodView: (props: any) => {
        const [showAll] = jest.requireActual('nuqs').useQueryState('showAll')
        return (
            <div data-testid="withdraw-method-view" data-show-all={showAll}>
                <span data-testid="page-title">{props.pageTitle}</span>
                <span data-testid="main-heading">{props.mainHeading}</span>
                <button data-testid="method-view-back" onClick={props.onExit}>
                    Back
                </button>
                <button data-testid="method-view-choose" onClick={props.onMethodChosen}>
                    Choose
                </button>
            </div>
        )
    },
}))

// ---------- import component under test AFTER all mocks ----------
import WithdrawPage from '../page'
import { clearScannedDestination, stashScannedDestination } from '@/features/withdraw/destination'
import { __testing as safeBackTesting } from '@/hooks/useSafeBack'

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

const mockOnUrlUpdate = jest.fn()

function renderWithdraw(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()
    return render(withdrawTree(params, queryClient))
}

// hasMemory: a URL write re-renders the page, as it does under Next.js. The
// adapter then renders again, and its queue reset (it runs on every render)
// would drop the writes under test.
function withdrawTree(params: Record<string, string>, queryClient: QueryClient, { hasMemory = false } = {}) {
    return (
        <NuqsTestingAdapter
            searchParams={params}
            onUrlUpdate={mockOnUrlUpdate}
            hasMemory={hasMemory}
            resetUrlUpdateQueueOnMount={!hasMemory}
        >
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
    mockSupportedChainsAndTokens.solana = {
        chainId: 'solana',
        tokens: [{ symbol: 'USDC', address: SOLANA_USDC }],
    }
    // Tron delivers USDT and no USDC — the token rule's fallback branch.
    mockSupportedChainsAndTokens.tron = { chainId: 'tron', tokens: [{ symbol: 'USDT', address: TRON_USDT }] }
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
    mockUseOfframpRate.mockReturnValue({ rate: 1, isError: false })

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
    safeBackTesting.reset()
    applyDefaults()
    // clearAllMocks() resets call history but not implementations, so restore
    // the default country resolution here — tests that override it (GROUP 6)
    // then don't leak into later tests regardless of order or early failure.
    mockGetCountryFromAccount.mockReturnValue({ iso2: 'US', path: 'us' })
    mockGetOfframpConfigFromAccount.mockReturnValue({ currency: 'usd', paymentRail: 'ach' })
    mockBankRate = '0.9'
    mockBankRateError = false
    mockUseRealAmountInput = false
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
        expect(mockRouterReplace).toHaveBeenCalledWith('/send')
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    // Regression: this branch used to router.push('/send') over the retained
    // /withdraw?method=bank entry, so send's safe-back popped right back into
    // the withdraw step — Back looped instead of unwinding (TASK-22424).
    test('Back from bank send method selection pops in-app history, not push', () => {
        window.history.pushState({}, '', '/withdraw?method=bank')
        renderWithdraw({ method: 'bank' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    test('Back from bank send method selection replaces to /send on a cold deep link', () => {
        renderWithdraw({ method: 'bank' })

        fireEvent.click(screen.getByTestId('method-view-back'))
        expect(mockRouterReplace).toHaveBeenCalledWith('/send')
        expect(mockRouterPush).not.toHaveBeenCalled()
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
        renderWithdraw({ method: 'crypto', step: 'amount' })

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
// GROUP 2b: bank amount typed in EUR, GBP, MXN or COP (TASK-23054)
// ============================================================
describe('GROUP 2b: bank amount typed in its currency', () => {
    beforeEach(() => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'germany' }
        mockWithdrawFlow.selectedBankAccount = { type: 'iban', details: { countryName: 'germany' } }
        mockGetOfframpConfigFromAccount.mockReturnValue({ currency: 'eur', paymentRail: 'sepa' })
        mockGetCountryFromAccount.mockReturnValue({ iso2: 'DE', path: 'germany' })
    })

    test('the field takes the bank amount in EUR', () => {
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('amount-field')).toHaveAttribute('data-symbol', 'EUR')
    })

    test('Continue hands the bank amount to the review, never as ?amount=', () => {
        renderWithdraw({ step: 'amount' })

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '90' } })
        fireEvent.click(screen.getByText('Continue'))

        const pushed = mockRouterPush.mock.calls.at(-1)?.[0] as string
        expect(pushed).toContain('destinationAmount=90')
        expect(pushed).not.toMatch(/[?&]amount=/)
    })

    // Staging, 2026-09-24: EUR 5 showed ≈ USD 5.71 and Continue did nothing. The
    // real field re-reported the amount on every render of the page, each report
    // wrote the URL, and in Next.js a URL write restores the router and discards
    // the navigation still in flight: Continue re-renders the page (setError), so
    // its push to the review never landed.
    test('Continue from a typed EUR amount reaches the review: a re-render writes no URL', async () => {
        mockUseRealAmountInput = true
        mockBankRate = '0.875'
        const params = { step: 'amount' }
        // drop URL updates earlier tests left queued: this adapter does not reset
        // its queue on render, so they would land in this test
        render(<NuqsTestingAdapter>{null}</NuqsTestingAdapter>).unmount()
        setSearchParams(params)
        const queryClient = createQueryClient()
        const view = render(withdrawTree(params, queryClient, { hasMemory: true }))
        const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)))

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '5' } })
        await settle()
        expect(mockOnUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain('destinationAmount=5')
        const writesAfterTyping = mockOnUrlUpdate.mock.calls.length

        view.rerender(withdrawTree(params, queryClient, { hasMemory: true }))
        await settle()
        expect(mockOnUrlUpdate.mock.calls.length).toBe(writesAfterTyping)

        fireEvent.click(screen.getByText('Continue'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/germany/bank?destinationAmount=5')
    })

    test('the checks run on the USD it converts to: 90 EUR at 0.9 is 100 USD, the whole balance', () => {
        renderWithdraw({ step: 'amount' })

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '91' } })

        expect(screen.getByText('Continue')).toBeDisabled()
    })

    test('a failed rate refresh keeps the field open with the last rate', () => {
        mockBankRateError = true
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('amount-field')).toHaveAttribute('data-symbol', 'EUR')
    })

    // One rate for the amount and the minimum: the old second rate call answered
    // '1' on failure and made the COP minimum $4,000.
    test('the minimum converts with the same quote rate: £2 at 0.79 is under the £3 minimum', () => {
        const bridgeUtils = jest.requireMock('@/utils/bridge.utils')
        bridgeUtils.getMinimumAmount.mockImplementation((iso2: string) => (iso2 === 'GB' ? 3 : 1))
        try {
            mockGetOfframpConfigFromAccount.mockReturnValue({ currency: 'gbp', paymentRail: 'faster_payments' })
            mockGetCountryFromAccount.mockReturnValue({ iso2: 'GB', path: 'united-kingdom' })
            mockBankRate = '0.79'
            renderWithdraw({ step: 'amount' })

            fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '2' } })
            expect(screen.getByText('Continue')).toBeDisabled()

            fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '4' } })
            expect(screen.getByText('Continue')).not.toBeDisabled()
            // the shared minimum takes the quote's rate: the sell-rate request never runs
            expect(mockUseGetExchangeRate).not.toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
        } finally {
            bridgeUtils.getMinimumAmount.mockImplementation(() => 1)
        }
    })

    test('a mid-typing "90." is handed on as 90', () => {
        renderWithdraw({ step: 'amount' })

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '90.' } })
        fireEvent.click(screen.getByText('Continue'))

        expect(mockRouterPush.mock.calls.at(-1)?.[0]).toBe('/withdraw/germany/bank?destinationAmount=90')
    })

    test('waits for the rate before opening the field', () => {
        mockBankRate = null
        renderWithdraw({ step: 'amount' })

        expect(screen.queryByTestId('amount-input')).not.toBeInTheDocument()
    })

    test('a US account keeps the USD amount', () => {
        mockGetOfframpConfigFromAccount.mockReturnValue({ currency: 'usd', paymentRail: 'ach' })
        renderWithdraw({ step: 'amount' })

        expect(screen.getByTestId('amount-field')).toHaveAttribute('data-symbol', '$')
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

    describe('a destination scanned into the flow (TASK-22251)', () => {
        // Real, publicly known addresses. The uppercase L is the character a
        // lowercasing pass would destroy — it must reach the recipient step intact.
        const SOLANA_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
        const SECOND_SOLANA_ADDRESS = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'
        const TRON_ADDRESS = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC'
        const scanEntry = (scan: string) => ({ method: 'crypto', step: 'amount', amount: '25', scan })

        const scanInto = (address: string) => {
            const id = stashScannedDestination(address, 'solana')
            if (!id) throw new Error('expected a payable destination')
            return id
        }

        beforeEach(() => {
            clearScannedDestination()
            mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        })

        test('seeds the recipient step with the scanned address, its chain and token', () => {
            renderWithdraw(scanEntry(scanInto(SOLANA_ADDRESS)))
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetSelectedChainID).toHaveBeenCalledWith('solana')
            expect(mockSetSelectedTokenAddress).toHaveBeenCalledWith(SOLANA_USDC)
            expect(mockSetRecipient).toHaveBeenCalledWith({ name: undefined, address: SOLANA_ADDRESS })
            expect(mockSetIsValidRecipient).toHaveBeenCalledWith(true)
            expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?method=crypto&amount=25')
        })

        // Tron has no USDC, so the token rule falls back to the chain's only
        // token. Scanning one must not land the recipient step on a token Rhino
        // cannot deliver there.
        test('a scanned Tron address seeds Tron and its USDT', () => {
            const id = stashScannedDestination(TRON_ADDRESS, 'tron')
            if (!id) throw new Error('expected a payable destination')

            renderWithdraw(scanEntry(id))
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetSelectedChainID).toHaveBeenCalledWith('tron')
            expect(mockSetSelectedTokenAddress).toHaveBeenCalledWith(TRON_USDT)
            expect(mockSetRecipient).toHaveBeenCalledWith({ name: undefined, address: TRON_ADDRESS })
        })

        test('carries the address onward in process, never in the next URL', () => {
            renderWithdraw(scanEntry(scanInto(SOLANA_ADDRESS)))
            fireEvent.click(screen.getByText('Continue'))

            expect(mockRouterPush.mock.calls.at(-1)?.[0]).not.toContain(SOLANA_ADDRESS)
        })

        // /withdraw keeps its layout mounted, so scanning from a bank withdrawal's
        // amount step arrives with that bank method still in flow memory. The scan
        // names the rail: without this, Continue follows the old bank route and the
        // scanned address is dropped.
        test('replaces a bank method the user left selected, and its saved account', () => {
            mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'spain' }

            renderWithdraw(scanEntry(scanInto(SOLANA_ADDRESS)))

            expect(mockSetSelectedMethod).toHaveBeenCalledWith({
                type: 'crypto',
                title: 'Crypto',
                countryPath: undefined,
            })
            expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(null)
        })

        // Same mounted layout: a second scan navigates without remounting, so the
        // flow must follow the new scan id rather than keep the first destination.
        test('a second scan wins over the first', () => {
            scanInto(SOLANA_ADDRESS)
            const second = scanInto(SECOND_SOLANA_ADDRESS)

            renderWithdraw(scanEntry(second))
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetRecipient).toHaveBeenCalledWith({ name: undefined, address: SECOND_SOLANA_ADDRESS })
            expect(mockSetRecipient).not.toHaveBeenCalledWith({ name: undefined, address: SOLANA_ADDRESS })
        })

        // Only the scan that stashed it gets it back. A withdrawal the user
        // started themselves, or a URL left over from an earlier scan, does not.
        test.each([
            ['the entry names no scan', undefined],
            ['the entry names a scan that is over', 'scan-does-not-exist'],
        ])('seeds nothing when %s', (_case, scan) => {
            scanInto(SOLANA_ADDRESS)

            renderWithdraw({ method: 'crypto', step: 'amount', amount: '25', ...(scan ? { scan } : {}) })
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetRecipient).not.toHaveBeenCalled()
            expect(mockSetIsValidRecipient).not.toHaveBeenCalled()
            expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?method=crypto&amount=25')
        })

        test('hands the destination over once, so pressing on again cannot re-apply it', () => {
            const id = scanInto(SOLANA_ADDRESS)

            renderWithdraw(scanEntry(id))
            fireEvent.click(screen.getByText('Continue'))
            mockSetRecipient.mockClear()
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetRecipient).not.toHaveBeenCalled()
        })

        test('leaves the step to its defaults when the chain list has no token yet', () => {
            // A recipient marked valid with no token to send is a broken review
            // step, so an unresolved chain seeds nothing at all.
            mockSupportedChainsAndTokens.solana = { chainId: 'solana', tokens: [] }

            renderWithdraw(scanEntry(scanInto(SOLANA_ADDRESS)))
            fireEvent.click(screen.getByText('Continue'))

            expect(mockSetSelectedChainID).not.toHaveBeenCalled()
            expect(mockSetSelectedTokenAddress).not.toHaveBeenCalled()
            expect(mockSetRecipient).not.toHaveBeenCalled()
            expect(mockSetIsValidRecipient).not.toHaveBeenCalled()
        })
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

    /*
     * Chip review 5291270247: the amount step's MX floor comes from the shared
     * Bridge-rate gate (useBankWithdrawMinimum), the same one the widget and the
     * bank submit read. A saved CLABE resolves to MX; 50 MXN at Bridge 16.5 is $4.
     */
    describe('a saved CLABE account (MX, 50 MXN floor)', () => {
        const bridgeUtils = jest.requireMock('@/utils/bridge.utils')
        beforeEach(() => {
            mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'mexico', title: 'To Bank' }
            mockWithdrawFlow.selectedBankAccount = { type: 'clabe', identifier: '646180111800000000' }
            mockGetCountryFromAccount.mockReturnValue({ iso2: 'MX', path: 'mexico' })
            bridgeUtils.getMinimumAmount.mockImplementation((iso2: string) => (iso2 === 'MX' ? 50 : 1))
        })
        afterEach(() => bridgeUtils.getMinimumAmount.mockImplementation(() => 1))

        test('Bridge 16.5: $3.99 is refused with the $4 floor', async () => {
            mockUseOfframpRate.mockReturnValue({ rate: 16.5, isError: false })
            renderWithdraw({ step: 'amount', amount: '3.99' })

            expect(screen.getByText('Continue')).toBeDisabled()
            await waitFor(() =>
                expect(mockSetError).toHaveBeenCalledWith({
                    showError: true,
                    errorMessage: 'Minimum withdrawal is $4.',
                })
            )
        })

        test('Bridge 16.5: exactly $4 continues to the bank flow', () => {
            mockUseOfframpRate.mockReturnValue({ rate: 16.5, isError: false })
            renderWithdraw({ step: 'amount', amount: '4' })

            fireEvent.click(screen.getByText('Continue'))
            expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('amount=4'))
            expect(mockUseOfframpRate).toHaveBeenCalledWith('MXN', { enabled: true })
        })

        /*
         * Fees v2: Bridge's gross 12.5 gives ceil(50 / 12.5) = $4, which pays
         * 49.85 MXN at the net 12.4625 — under the 50 MXN floor. The public
         * withdrawal rate is the net one, so the floor is ceil(4.012) = $5.
         */
        test('net rate 12.4625 (Bridge 12.5 less 0.30%): $4.99 is refused with the $5 floor', async () => {
            mockUseOfframpRate.mockReturnValue({ rate: 12.4625, isError: false })
            renderWithdraw({ step: 'amount', amount: '4.99' })

            expect(screen.getByText('Continue')).toBeDisabled()
            await waitFor(() =>
                expect(mockSetError).toHaveBeenCalledWith({
                    showError: true,
                    errorMessage: 'Minimum withdrawal is $5.',
                })
            )
        })

        test('net rate 12.4625: exactly $5 continues', () => {
            mockUseOfframpRate.mockReturnValue({ rate: 12.4625, isError: false })
            renderWithdraw({ step: 'amount', amount: '5' })

            fireEvent.click(screen.getByText('Continue'))
            expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('amount=5'))
        })

        test('Bridge rate failed: Continue stays disabled and says the rate is unavailable, never a $50 floor', async () => {
            mockUseOfframpRate.mockReturnValue({ rate: null, isError: true })
            renderWithdraw({ step: 'amount', amount: '100' })

            expect(screen.getByText('Continue')).toBeDisabled()
            await waitFor(() =>
                expect(mockSetError).toHaveBeenCalledWith({
                    showError: true,
                    errorMessage: 'Rate currently unavailable',
                })
            )
            expect(mockSetError).not.toHaveBeenCalledWith(
                expect.objectContaining({ errorMessage: expect.stringContaining('$50') })
            )
            expect(mockRouterPush).not.toHaveBeenCalled()
        })

        test('Bridge rate pending: Continue stays disabled with no error yet', async () => {
            mockUseOfframpRate.mockReturnValue({ rate: null, isError: false })
            renderWithdraw({ step: 'amount', amount: '100' })

            expect(screen.getByText('Continue')).toBeDisabled()
            await waitFor(() => expect(mockSetError).toHaveBeenCalledWith({ showError: false, errorMessage: '' }))
            expect(mockSetError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        })
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

    test('Marks the amount as a max withdrawal, and unmarks it on any edit', () => {
        // The flag is what lets the crypto path settle the sub-cent remainder
        // the displayed 2 decimals leave behind (TASK-21899).
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('12.345678', 6),
            formattedSpendableBalance: '12.34',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 12.345678,
        })

        renderWithdraw({ step: 'amount' })

        fireEvent.click(screen.getByTestId('use-full-balance'))
        expect(mockSetIsMaxWithdrawal).toHaveBeenLastCalledWith(true)

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '5' } })
        expect(mockSetIsMaxWithdrawal).toHaveBeenLastCalledWith(false)
    })

    test('Hands down the full-precision balance while the field shows cents', () => {
        // The flow passes the number its own validation compares against, not
        // the rounded label; the input is what floors it for display, and the
        // crypto path recovers the remainder from the flag (TASK-21899).
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('12.345678', 6),
            formattedSpendableBalance: '12.34',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 12.345678,
        })

        renderWithdraw({ step: 'amount' })
        expect(screen.getByTestId('use-full-balance')).toHaveAttribute('data-fill', '12.345678')

        fireEvent.click(screen.getByTestId('use-full-balance'))

        expect(screen.getByTestId('amount-field')).toHaveValue('12.34')
        expect(screen.getByText('Continue')).not.toBeDisabled()
    })

    test('Full balance passes validation and continues with that amount', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }

        renderWithdraw({ step: 'amount' })
        fireEvent.click(screen.getByTestId('use-full-balance'))

        const continueBtn = screen.getByText('Continue')
        expect(continueBtn).not.toBeDisabled()

        fireEvent.click(continueBtn)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/crypto?amount=100')
    })

    test('Full balance below the method minimum keeps Continue disabled', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        mockUseWallet.mockReturnValue({
            spendableBalance: parseUnits('0.5', 6),
            formattedSpendableBalance: '0.50',
            hasSufficientSpendableBalance: (amt: string | number) => Number(amt) <= 0.5,
        })

        renderWithdraw({ step: 'amount' })
        fireEvent.click(screen.getByTestId('use-full-balance'))

        expect(screen.getByText('Continue')).toBeDisabled()
        // validation is debounced 300ms behind typing
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

        renderWithdraw({ step: 'amount' })

        expect(screen.queryByTestId('use-full-balance')).not.toBeInTheDocument()
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
    // Regression: this handler used to router.push('/send') over the retained
    // /withdraw?method=crypto entry, so send's safe-back popped right back into
    // the amount step and ?method=crypto re-selected crypto — Back looped
    // between Send and the amount screen forever (TASK-22424).
    test('Back from crypto send pops in-app history, not push', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        window.history.pushState({}, '', '/withdraw?method=crypto')
        renderWithdraw({ method: 'crypto', step: 'amount' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    test('Back from crypto send replaces to /send on a cold deep link', () => {
        mockWithdrawFlow.selectedMethod = { type: 'crypto' }
        renderWithdraw({ method: 'crypto', step: 'amount' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockRouterReplace).toHaveBeenCalledWith('/send')
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    test('Back from a selected bank country returns to the country list', async () => {
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'us' }
        renderWithdraw({ step: 'amount' })

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(null)
        await waitFor(() => expect(mockOnUrlUpdate).toHaveBeenCalled())
        expect(mockOnUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('showAll')).toBe('true')
    })

    test('a bank-send return does not reset an explicit country-list choice', () => {
        renderWithdraw({ method: 'bank', showAll: 'true' })
        expect(screen.getByTestId('withdraw-method-view')).toHaveAttribute('data-show-all', 'true')
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
// GROUP 6b: links written before the amount moved last (TASK-22589)
// ============================================================
describe('GROUP 6b: old deep links never dead-end', () => {
    test('?step=amount with nothing chosen falls back to the pick screen', () => {
        mockWithdrawFlow.selectedMethod = null
        renderWithdraw({ step: 'amount', amount: '50' })

        expect(screen.getByTestId('withdraw-method-view')).toBeInTheDocument()
    })

    test('?step=amount for a bank country with no account yet goes to that country form', () => {
        // the amount was typed first under the old order — keep it in the URL
        // and send the user to the destination the flow still needs
        mockWithdrawFlow.selectedMethod = { type: 'bridge', countryPath: 'germany' }
        mockWithdrawFlow.selectedBankAccount = null

        renderWithdraw({ step: 'amount', amount: '50' })
        fireEvent.click(screen.getByText('Continue'))

        const pushed = mockRouterPush.mock.calls.at(-1)?.[0] as string
        expect(pushed).toContain('/withdraw/germany')
        expect(pushed).toContain('step=form')
        expect(pushed).toContain('amount=50')
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
