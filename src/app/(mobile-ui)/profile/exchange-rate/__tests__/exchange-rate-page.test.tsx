/**
 * /profile/exchange-rate — "Try it!" CTA navigation.
 *
 * The CTA drops the user into the add-money / withdraw roots, whose back buttons
 * reset to /home. Without an explicit origin the user is stranded there, which is
 * the bug these tests lock down: every CTA target carries ?returnTo back here.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'

// The withdrawal rate (fees v2: net of Peanut's margin while collected) — the
// only network the real minimum gate (useBankWithdrawMinimum → useOfframpRate)
// makes here.
const mockGetBridgeRate = jest.fn()
jest.mock('@/utils/fx.utils', () => ({
    ...jest.requireActual('@/utils/fx.utils'),
    fetchOfframpRate: (...args: unknown[]) => mockGetBridgeRate(...args),
}))

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

const mockUseCapabilities = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => mockUseCapabilities(),
}))

jest.mock('@/utils/regions.utils', () => ({
    deriveRegionAccess: () => ({ unlockedRegions: [] }),
}))

const mockGetRedirectRoute = jest.fn()
jest.mock('@/utils/exchangeRateWidget.utils', () => ({
    ...jest.requireActual('@/utils/exchangeRateWidget.utils'),
    getExchangeRateWidgetRedirectRoute: (...args: any[]) => mockGetRedirectRoute(...args),
}))

// The page reads the widget's currency pair out of the same nuqs query state
// the widget writes, so the CTA label can name the flow the tap will open.
const mockPair = { from: 'USD', to: 'EUR' }
jest.mock('nuqs', () => ({
    parseAsString: { withDefault: (defaultValue: string) => ({ defaultValue }) },
    useQueryStates: () => [mockPair, jest.fn()],
}))

jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: any) => (
        <button data-testid="nav-back" onClick={onPrev}>
            Back
        </button>
    ),
}))

// The real widget clamps its own currencies via `restrictToRoutable` — this
// stub instead forwards whatever the URL currently says, so the CTA-handler
// tests below exercise the page's own defensive clamp independently of that.
// It also exposes the minimum policy the page hands it, and taps with the
// on-screen amount the real widget passes (null when the field is empty).
const mockMinimumPolicy: { current: any } = { current: null }
const mockLabels: { current: any } = { current: null }
const mockCtaAmount: { current: number | null } = { current: null }
jest.mock('@/components/Global/ExchangeRateWidget', () => ({
    __esModule: true,
    default: ({ ctaAction, ctaLabel, ctaDisabled, minimumPolicy, labels }: any) => {
        mockMinimumPolicy.current = minimumPolicy
        mockLabels.current = labels
        return (
            <button
                disabled={ctaDisabled}
                data-testid="widget-cta"
                onClick={() => ctaAction(mockPair.from, mockPair.to, mockCtaAmount.current)}
            >
                {ctaLabel}
            </button>
        )
    },
}))

import ExchangeRatePage from '../page'

let queryClient: QueryClient
const renderPage = (search = '') => {
    window.history.replaceState({}, '', `/profile/exchange-rate${search}`)
    return render(
        <QueryClientProvider client={queryClient}>
            <IntlWrapper>
                <ExchangeRatePage />
            </IntlWrapper>
        </QueryClientProvider>
    )
}

afterEach(() => queryClient.clear())

beforeEach(() => {
    jest.clearAllMocks()
    // the rate query keeps its own retry rule; only the wait between tries is removed
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } } })
    mockGetBridgeRate.mockRejectedValue(new Error('not mocked for this test'))
    mockPair.from = 'USD'
    mockPair.to = 'EUR'
    mockCtaAmount.current = null
    mockMinimumPolicy.current = null
    mockUseWallet.mockReturnValue({ spendableBalance: 0n, isFetchingSpendableBalance: false })
    mockUseCapabilities.mockReturnValue({ rails: [] })
    mockGetRedirectRoute.mockReturnValue('/add-money')
})

describe('exchange-rate CTA', () => {
    it('waits for spendable balance instead of treating unresolved funds as zero', () => {
        mockUseWallet.mockReturnValue({ balance: 0n, spendableBalance: undefined, isFetchingSpendableBalance: true })
        renderPage()
        expect(screen.getByTestId('widget-cta')).toBeDisabled()
        fireEvent.click(screen.getByTestId('widget-cta'))
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it.each([0n, 5_000_000n])(
        'routes USD/EUR using resolved spendable funds %s, including card collateral',
        (funds) => {
            mockUseWallet.mockReturnValue({ balance: 0n, spendableBalance: funds, isFetchingSpendableBalance: false })
            mockGetRedirectRoute.mockImplementation(
                jest.requireActual('@/utils/exchangeRateWidget.utils').getExchangeRateWidgetRedirectRoute
            )
            renderPage()
            fireEvent.click(screen.getByTestId('widget-cta'))
            const destination = new URL(mockRouterPush.mock.calls[0][0], 'https://peanut.test')
            expect(destination.pathname.startsWith(funds > 0n ? '/withdraw' : '/add-money')).toBe(true)
            expect(destination.searchParams.get('returnTo')).toBe('/profile/exchange-rate')
            expect(mockGetRedirectRoute).toHaveBeenLastCalledWith('USD', 'EUR', Number(funds) / 1_000_000, [])
        }
    )

    it('tells the destination to send the user back here', () => {
        renderPage()

        fireEvent.click(screen.getByTestId('widget-cta'))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money?returnTo=%2Fprofile%2Fexchange-rate')
    })

    it('carries the widget state so back restores the pair the user was looking at', () => {
        renderPage('?from=USD&to=EUR&amount=25')

        fireEvent.click(screen.getByTestId('widget-cta'))
        const pushed: string = mockRouterPush.mock.calls[0][0]
        expect(new URLSearchParams(pushed.split('?')[1]).get('returnTo')).toBe(
            '/profile/exchange-rate?from=USD&to=EUR&amount=25'
        )
    })

    it('preserves a query string the destination route already has', () => {
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=EUR')
        renderPage()

        fireEvent.click(screen.getByTestId('widget-cta'))
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw?currencyCode=EUR&returnTo=%2Fprofile%2Fexchange-rate')
    })

    /*
     * "You send" is the `?amount=` every /withdraw/* screen reads. It comes
     * from the tap, not this page's URL copy (which the widget writes only
     * after its debounce), so a just-typed amount travels (TASK-22294).
     * Add-money routes get none: their typed side is local currency.
     */
    it('carries the tapped USD amount into the withdraw route, and not into add-money', () => {
        mockCtaAmount.current = 100
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=ARS')
        renderPage('?from=USD&to=ARS&amount=10')
        fireEvent.click(screen.getByTestId('widget-cta'))
        const withdrawParams = new URL(mockRouterPush.mock.calls[0][0], 'https://peanut.test').searchParams
        expect(withdrawParams.get('amount')).toBe('100')
        expect(withdrawParams.get('currencyCode')).toBe('ARS')
        expect(withdrawParams.get('returnTo')).toBe('/profile/exchange-rate?from=USD&to=ARS&amount=10')

        mockRouterPush.mockClear()
        mockGetRedirectRoute.mockReturnValue('/add-money/argentina')
        fireEvent.click(screen.getByTestId('widget-cta'))
        expect(mockRouterPush.mock.calls[0][0]).not.toContain('amount=')
    })

    it('sends no amount when the field is empty', () => {
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=ARS')
        renderPage()
        fireEvent.click(screen.getByTestId('widget-cta'))
        expect(mockRouterPush.mock.calls[0][0]).not.toContain('amount=')
    })

    /*
     * The route's floor reaches the widget as a policy resolved with the
     * widget's own rate — the same limits the withdraw flows enforce, so the
     * CTA can say "1 BRL" before the tap instead of the PIX flow refusing the
     * amount one screen later (TASK-22235, TASK-22297).
     */
    it('hands the widget the withdraw route minimum, in the unit that route states it', () => {
        mockUseWallet.mockReturnValue({ spendableBalance: 5_000_000n, isFetchingSpendableBalance: false })
        mockPair.to = 'BRL'
        renderPage()

        expect(mockMinimumPolicy.current).toBeTruthy()
        const minimum = mockMinimumPolicy.current.resolve(5.2)
        expect(minimum).toEqual({ amount: 1, currency: 'BRL' })
        expect(mockMinimumPolicy.current.label(minimum)).toBe('Minimum withdrawal: 1 BRL.')
    })

    it('resolves no minimum for an add-money route (zero balance)', () => {
        mockPair.to = 'BRL'
        renderPage()

        expect(mockMinimumPolicy.current.resolve(5.2)).toBeNull()
    })

    /*
     * Chip review 5291270247. The Bridge floor comes from Bridge's own rate
     * through the shared gate — the one the amount step and bank submit
     * enforce — never from the widget's indicative display rate.
     */
    describe('a Bridge corridor (MXN) floor', () => {
        beforeEach(() => {
            mockUseWallet.mockReturnValue({ spendableBalance: 50_000_000n, isFetchingSpendableBalance: false })
            mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=MXN')
            mockPair.to = 'MXN'
        })

        it('display 17, Bridge 16.5: $4, not the display-derived $3', async () => {
            mockGetBridgeRate.mockResolvedValue(16.5)
            renderPage()

            await waitFor(() => expect(mockMinimumPolicy.current.blocked).toBeUndefined())
            expect(mockMinimumPolicy.current.resolve(17)).toEqual({ amount: 4, currency: 'USD' })
            expect(mockGetBridgeRate).toHaveBeenCalledWith('MXN')
        })

        it('display 17, Bridge 17: $3', async () => {
            mockGetBridgeRate.mockResolvedValue(17)
            renderPage()

            await waitFor(() => expect(mockMinimumPolicy.current.blocked).toBeUndefined())
            expect(mockMinimumPolicy.current.resolve(17)).toEqual({ amount: 3, currency: 'USD' })
        })

        // Bridge 12.5 gross → $4, which pays 49.85 MXN at the net 12.4625; the net rate gives $5
        it('withdrawal rate with Peanut’s margin (12.4625): $5, not the gross $4', async () => {
            mockGetBridgeRate.mockResolvedValue(12.4625)
            renderPage()

            await waitFor(() => expect(mockMinimumPolicy.current.blocked).toBeUndefined())
            expect(mockMinimumPolicy.current.resolve(12.4625)).toEqual({ amount: 5, currency: 'USD' })
        })

        it('Bridge rate failing while a display quote exists: blocked, no floor, and the tap does nothing', async () => {
            mockGetBridgeRate.mockRejectedValue(new Error('upstream 500'))
            mockCtaAmount.current = 100
            renderPage()

            await waitFor(() => expect(mockMinimumPolicy.current.blocked).toBe('unavailable'))
            expect(mockMinimumPolicy.current.resolve(17)).toBeNull()
            fireEvent.click(screen.getByTestId('widget-cta'))
            expect(mockRouterPush).not.toHaveBeenCalled()
        })

        it('Bridge rate pending: blocked, the tap does nothing', () => {
            mockGetBridgeRate.mockReturnValue(new Promise(() => {}))
            mockCtaAmount.current = 100
            renderPage()

            expect(mockMinimumPolicy.current.blocked).toBe('pending')
            fireEvent.click(screen.getByTestId('widget-cta'))
            expect(mockRouterPush).not.toHaveBeenCalled()
        })
    })

    it.each([
        ['EUR (fixed $1 floor)', 'EUR', { amount: 1, currency: 'USD' }],
        ['BRL (Manteca PIX floor)', 'BRL', { amount: 1, currency: 'BRL' }],
        ['ARS (Manteca floor)', 'ARS', { amount: 1, currency: 'USD' }],
    ])('%s: no Bridge rate request, never blocked', (_label, to, minimum) => {
        mockUseWallet.mockReturnValue({ spendableBalance: 50_000_000n, isFetchingSpendableBalance: false })
        mockPair.to = to
        renderPage()

        expect(mockMinimumPolicy.current.blocked).toBeUndefined()
        expect(mockMinimumPolicy.current.resolve(5.2)).toEqual(minimum)
        expect(mockGetBridgeRate).not.toHaveBeenCalled()
    })

    it('a zero-balance (add-money) MXN route makes no Bridge request and is not blocked', () => {
        mockPair.to = 'MXN'
        renderPage()

        expect(mockMinimumPolicy.current.blocked).toBeUndefined()
        expect(mockGetBridgeRate).not.toHaveBeenCalled()
    })

    // The widget shows no fee rows; the app hands it the translated rate note
    // and no fee-free label at all (TASK-21104).
    it('hands the widget the app-catalog rate note and no fee labels', () => {
        renderPage()

        expect(mockLabels.current.rateNote).toBe(
            'Estimated rate; may include conversion costs. Review any fees before confirming.'
        )
        expect(Object.keys(mockLabels.current)).not.toEqual(expect.arrayContaining(['bankFee', 'free', 'peanutFee']))
    })

    /*
     * getExchangeRateWidgetRedirectRoute sends a zero balance, and any pair
     * that is not USD → local, to /add-money. A fixed "Withdraw now" label
     * therefore named the opposite flow for common inputs, so it is derived
     * from the computed destination instead.
     */
    it('names add money when the pair and balance route there', () => {
        mockGetRedirectRoute.mockReturnValue('/add-money')
        renderPage()

        expect(screen.getByTestId('widget-cta')).toHaveTextContent('Add money')
    })

    it('names the withdrawal when the destination is the withdraw flow', () => {
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=EUR')
        renderPage()

        expect(screen.getByTestId('widget-cta')).toHaveTextContent('Withdraw now')
    })

    /*
     * A stale bookmark or hand-edited URL can carry a currency the dropdown no
     * longer offers (`?from=PLN`, predating the six-currency trim). The label
     * above is derived from a clamped pair; the click handler used to pass the
     * widget's raw values straight through, so a positive balance with
     * `?from=PLN&to=EUR` named "Withdraw now" but routed to /add-money/poland.
     */
    it('clamps a non-routable currency to the same pair for both the label and the route', () => {
        mockPair.from = 'PLN'
        mockPair.to = 'EUR'
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=EUR')
        renderPage()

        expect(screen.getByTestId('widget-cta')).toHaveTextContent('Withdraw now')

        fireEvent.click(screen.getByTestId('widget-cta'))

        // Every call — the label's `destination` computation and the click
        // handler's redirect — must see PLN clamped to the USD default, never
        // the raw, unsupported currency.
        expect(mockGetRedirectRoute.mock.calls.length).toBeGreaterThan(0)
        for (const [from, to] of mockGetRedirectRoute.mock.calls) {
            expect(from).toBe('USD')
            expect(to).toBe('EUR')
        }
    })

    /*
     * `?from=PLN&to=USD` is the collision case: PLN is invalid and would
     * independently default to 'USD', landing on the same currency as the
     * other, explicit and valid 'USD' side. The page must resolve this pair
     * through the same pair-aware function the widget uses (EUR/USD), not its
     * own independent fallback (which used to produce USD/USD) — otherwise
     * the label names one flow and the tap opens another.
     */
    it('resolves an invalid source next to an explicit USD to EUR, not USD/USD', () => {
        mockPair.from = 'PLN'
        mockPair.to = 'USD'
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=USD')
        renderPage()

        fireEvent.click(screen.getByTestId('widget-cta'))

        expect(mockGetRedirectRoute.mock.calls.length).toBeGreaterThan(0)
        for (const [from, to] of mockGetRedirectRoute.mock.calls) {
            expect(from).toBe('EUR')
            expect(to).toBe('USD')
        }
    })
})
