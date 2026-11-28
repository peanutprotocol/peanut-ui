/**
 * /profile/exchange-rate — Rates & Fees screen (TASK-25349).
 *
 * Covers:
 * - CTA routing & ?returnTo preservation + spendable-balance gating
 * - Legacy ?from=&to= clamping & collision handling
 * - 2-tab layout (Exchange rates | Fees) with canonical provider-fee schedule
 * - Adaptable currency list (keeping USD 1:1) and ARS benchmarks sub-view
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { FALLBACK_FEE_SCHEDULE } from '@/features/rates-fees/rates-fees.utils'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
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
    getExchangeRateWidgetRedirectRoute: (...args: unknown[]) => mockGetRedirectRoute(...args),
}))

const mockQuery = {
    tab: 'rates',
    cur: '',
    dir: '',
    view: 'main',
    from: 'USD',
    to: 'EUR',
}
const mockSetQuery = jest.fn((patch: Partial<typeof mockQuery>) => {
    Object.assign(mockQuery, patch)
})
jest.mock('nuqs', () => ({
    parseAsString: { withDefault: (defaultValue: string) => ({ defaultValue }) },
    useQueryStates: () => [mockQuery, mockSetQuery],
}))

jest.mock('@/features/rates-fees/useRatesAndFees', () => ({
    useAllDisplayRates: () => ({
        isLoading: false,
        data: {
            base: 'USD',
            generatedAt: '2026-11-27T10:50:00.000Z',
            rates: {
                ARS: { code: 'ARS', buyRate: 1782.59, sellRate: 1716.55, effectiveAt: '2026-11-27T10:50:00.000Z' },
                EUR: { code: 'EUR', buyRate: 0.928, sellRate: 0.921, effectiveAt: '2026-11-27T10:50:00.000Z' },
                BRL: { code: 'BRL', buyRate: 5.76, sellRate: 5.7, effectiveAt: '2026-11-27T10:50:00.000Z' },
                USD: { code: 'USD', buyRate: 1, sellRate: 1, effectiveAt: null },
                GBP: { code: 'GBP', buyRate: 0.794, sellRate: 0.786, effectiveAt: '2026-11-27T10:50:00.000Z' },
                MXN: { code: 'MXN', buyRate: 20.28, sellRate: 20.02, effectiveAt: '2026-11-27T10:50:00.000Z' },
                COP: { code: 'COP', buyRate: 4415, sellRate: 4350, effectiveAt: '2026-11-27T10:50:00.000Z' },
            },
        },
    }),
    useFeeSchedule: () => ({
        isLoading: false,
        schedule: FALLBACK_FEE_SCHEDULE,
    }),
    useReferenceBenchmarks: () => ({
        isLoading: false,
        data: {
            currency: 'ARS',
            base: 'USD',
            source: 'dolarapi.com',
            indicative: true,
            benchmarks: [
                { key: 'cripto', buy: '1752.6', sell: '1758.08', effectiveAt: '2026-11-27T10:45:00.000Z' },
                { key: 'mep', buy: '1663', sell: '1665.7', effectiveAt: '2026-11-27T10:45:00.000Z' },
            ],
            generatedAt: '2026-11-27T10:50:00.000Z',
        },
    }),
}))

jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev, title }: { onPrev?: () => void; title?: string }) => (
        <div>
            <button data-testid="nav-back" onClick={onPrev}>
                Back
            </button>
            <span>{title}</span>
        </div>
    ),
}))

import ExchangeRatePage from '../page'

const renderPage = (search = '') => {
    window.history.replaceState({}, '', `/profile/exchange-rate${search}`)
    return render(
        <IntlWrapper>
            <ExchangeRatePage />
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.tab = 'rates'
    mockQuery.cur = ''
    mockQuery.dir = ''
    mockQuery.view = 'main'
    mockQuery.from = 'USD'
    mockQuery.to = 'EUR'
    mockUseAuth.mockReturnValue({ user: { residence: { verified: { country: 'DE' } } } })
    mockUseWallet.mockReturnValue({ spendableBalance: 0n, isFetchingSpendableBalance: false })
    mockUseCapabilities.mockReturnValue({ rails: [] })
    mockGetRedirectRoute.mockReturnValue('/add-money')
})

describe('exchange-rate CTA & routing', () => {
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

    it('carries the URL state so back restores the view the user was looking at', () => {
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

    it('clamps a non-routable currency to the same pair for both the label and the route', () => {
        mockQuery.from = 'PLN'
        mockQuery.to = 'EUR'
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=EUR')
        renderPage()

        expect(screen.getByTestId('widget-cta')).toHaveTextContent('Withdraw now')
        fireEvent.click(screen.getByTestId('widget-cta'))

        for (const [from, to] of mockGetRedirectRoute.mock.calls) {
            expect(from).toBe('USD')
            expect(to).toBe('EUR')
        }
    })

    it('resolves an invalid source next to an explicit USD to EUR, not USD/USD', () => {
        mockQuery.from = 'PLN'
        mockQuery.to = 'USD'
        mockGetRedirectRoute.mockReturnValue('/withdraw?currencyCode=USD')
        renderPage()

        fireEvent.click(screen.getByTestId('widget-cta'))

        for (const [from, to] of mockGetRedirectRoute.mock.calls) {
            expect(from).toBe('EUR')
            expect(to).toBe('USD')
        }
    })
})

describe('Rates & Fees tabs and sub-views', () => {
    it('shows the ARS buy rate and Compare other dollar rates row for Argentine users', () => {
        mockUseAuth.mockReturnValue({ user: { residence: { verified: { country: 'AR' } } } })
        mockQuery.from = ''
        mockQuery.to = ''
        renderPage()

        expect(screen.getByTestId('rates-hero-rate')).toHaveTextContent('1 USD = 1,782.59 ARS')
        expect(screen.getByTestId('rates-open-compare')).toBeInTheDocument()
    })

    it('renders the Fees tab with canonical per-transfer fees, 0% Peanut card fee, and L2 crypto withdrawals', () => {
        mockQuery.tab = 'fees'
        renderPage()

        expect(screen.getByText('USD · ACH / FedNow')).toBeInTheDocument()
        expect(screen.getByText('$20')).toBeInTheDocument()
        expect(screen.getByText('€0')).toBeInTheDocument()
        expect(screen.getByText('R$ 0.75')).toBeInTheDocument()
        expect(screen.getByText('0%')).toBeInTheDocument()
        expect(screen.getByText('USDC / USDT deposits')).toBeInTheDocument()
        expect(screen.getByText('Shown in quote')).toBeInTheDocument()
        expect(screen.getByText('$0.50 + 0.07%')).toBeInTheDocument()
    })

    it('deducts the R$ 0.75 provider fee from Brazil Pix withdrawal proceeds', () => {
        mockUseAuth.mockReturnValue({ user: { residence: { verified: { country: 'BR' } } } })
        mockQuery.from = ''
        mockQuery.to = ''
        mockQuery.cur = 'BRL'
        mockQuery.dir = 'withdraw'
        renderPage()

        // Default withdraw amount is 100 USD * 5.70 BRL/USD - R$ 0.75 = R$ 569.25
        expect(screen.getByTestId('rates-converted-output')).toHaveTextContent('569.25')
    })

    it('renders All currencies with adaptable order and keeps USD 1:1', () => {
        mockUseAuth.mockReturnValue({ user: { residence: { verified: { country: 'BR' } } } })
        mockQuery.view = 'all'
        renderPage()

        expect(screen.getByTestId('currency-row-BRL')).toBeInTheDocument()
        expect(screen.getByTestId('currency-row-USD')).toHaveTextContent('1:1')
    })
})
