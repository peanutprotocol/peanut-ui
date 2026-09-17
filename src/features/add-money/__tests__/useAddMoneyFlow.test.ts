/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
const mockGetStoredRedirect = jest.fn() as jest.Mock
const mockClearRedirectUrl = jest.fn()
const mockGetFromLocalStorage = jest.fn() as jest.Mock

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
}))

const mockResetOnrampFlow = jest.fn()
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({ resetOnrampFlow: mockResetOnrampFlow }),
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: any[]) => mockCapture(...args) },
}))

jest.mock('@/utils/general.utils', () => ({
    getStoredRedirect: mockGetStoredRedirect,
    clearRedirectUrl: mockClearRedirectUrl,
    getFromLocalStorage: mockGetFromLocalStorage,
    // real behavior: same-origin paths pass, everything else is rejected
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

// the country pick reads the country's live bank rail — the rail knows where
// it goes, so there is no provider branching left in the hook
jest.mock('@/features/destinations/country-rails', () => ({
    soleLiveRailForCountry: (id: string) =>
        ({
            AR: { id: 'bank-transfer-add', path: '/add-money/argentina/manteca' },
            DE: { id: 'bank-transfer-add', path: '/add-money/germany/bank' },
        })[id] ?? null,
}))

jest.mock('@/utils/native-routes', () => ({
    addMoneyCountryUrl: (path: string) => `/add-money/${path}`,
    rewriteMethodPath: (path: string) => path,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { DEPOSIT_METHOD_SELECTED: 'deposit_method_selected' },
}))

// the corridor resolver and the rail catalogue are the code under test here —
// only the two answers that come from the user are mocked
const mockDepositAccountsEnabled = jest.fn(() => true)
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccountsEnabled(),
}))

const mockOfferedCorridors = jest.fn(() => [] as string[])
jest.mock('@/features/deposit-accounts/useOfferedCorridors', () => ({
    useOfferedCorridors: () => mockOfferedCorridors(),
}))

import { useAddMoneyFlow } from '../useAddMoneyFlow'

const GERMANY = { id: 'DEU', type: 'country', title: 'Germany', path: 'germany', iso2: 'DE', currency: 'EUR' }
const BRAZIL = { id: 'BRA', type: 'country', title: 'Brazil', path: 'brazil', iso2: 'BR', currency: 'BRL' }

const renderFlow = (search = '', onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    renderHook(() => useAddMoneyFlow(), { wrapper: withNuqsTestingAdapter({ searchParams: search, onUrlUpdate }) })

describe('useAddMoneyFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetStoredRedirect.mockReturnValue(null)
        mockGetFromLocalStorage.mockReturnValue(null)
        mockDepositAccountsEnabled.mockReturnValue(true)
        mockOfferedCorridors.mockReturnValue([])
    })

    it('bare root redirects to the home add drawer and resets onramp state', () => {
        renderFlow()
        expect(mockResetOnrampFlow).toHaveBeenCalled()
        expect(mockRouterReplace).toHaveBeenCalledWith('/home?drawer=add')
    })

    it('bare root carries a same-origin returnTo, drops an off-origin one', () => {
        renderFlow('?returnTo=/profile/exchange-rate')
        expect(mockRouterReplace).toHaveBeenCalledWith(
            `/home?drawer=add&returnTo=${encodeURIComponent('/profile/exchange-rate')}`
        )

        mockRouterReplace.mockClear()
        renderFlow(`?returnTo=${encodeURIComponent('https://evil.example/phish')}`)
        expect(mockRouterReplace).toHaveBeenCalledWith('/home?drawer=add')
    })

    it('?method=bank is not bare root and does not redirect', () => {
        const { result } = renderFlow('?method=bank')
        expect(result.current.isBareRoot).toBe(false)
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('back honours a same-origin returnTo, resets to /home otherwise', () => {
        const { result } = renderFlow(`?method=bank&returnTo=${encodeURIComponent('/profile/exchange-rate')}`)
        act(() => result.current.handleBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate')

        mockRouterPush.mockClear()
        const { result: r2 } = renderFlow('?method=bank')
        act(() => r2.current.handleBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    it('clears the redirect snapshot it routed from', () => {
        const redirect = {
            destination: '/claim?step=claim&id=payment-1',
            origin: 'deep-link',
            generationId: 'generation-a',
        }
        mockGetStoredRedirect.mockReturnValue(redirect)
        mockGetFromLocalStorage.mockReturnValue(true)

        const { result } = renderFlow('?method=bank')
        act(() => result.current.handleBack())

        expect(mockRouterPush).toHaveBeenCalledWith(redirect.destination)
        expect(mockClearRedirectUrl).toHaveBeenCalledWith(redirect)
    })

    it('a country in the URL keeps onramp state (only the root list resets it)', () => {
        // handleBack itself never runs with ?country= — every country render
        // path returns a component with its own back behavior — so the old
        // write-params-in-place branch was unreachable and is gone.
        renderFlow('?country=austria')
        expect(mockResetOnrampFlow).not.toHaveBeenCalled()
    })

    it('routes a country click to manteca, bridge bank, or the per-country screen', () => {
        const { result } = renderFlow('?method=bank')

        act(() => result.current.handleCountryClick({ id: 'AR', path: 'argentina' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/argentina/manteca')

        act(() => result.current.handleCountryClick({ id: 'DE', path: 'germany' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')

        act(() => result.current.handleCountryClick({ id: 'TD', path: 'chad' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/chad')
        expect(mockCapture).toHaveBeenCalledTimes(3)
    })

    it('opens the deposit-accounts flow in place for a corridor the user is offered', async () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderFlow('?method=bank', (e) => updates.push(e))

        act(() => result.current.handleCountryClick(GERMANY as any))

        // nuqs queues its url writes, so the recorded state arrives a tick later
        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBe('SEPA_EU'))
        expect(updates.at(-1)?.searchParams.get('step')).toBe('details')
        // no navigation: the same screens the get-paid route renders open here
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('sends a corridor with no standing account to the rail its own catalogue names', () => {
        mockOfferedCorridors.mockReturnValue(['PIX_BR'])
        const { result } = renderFlow('?method=bank')

        act(() => result.current.handleCountryClick(BRAZIL as any))

        // from DEPOSIT_RAILS.PIX_BR.topUpHref, not a second copy of the path
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/brazil/manteca')
    })

    it('keeps the bank flow for a corridor the user has no rail for, and while the flag is off', () => {
        mockOfferedCorridors.mockReturnValue([])
        const { result } = renderFlow('?method=bank')
        act(() => result.current.handleCountryClick(GERMANY as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany')

        mockRouterPush.mockClear()
        mockDepositAccountsEnabled.mockReturnValue(false)
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const { result: r2 } = renderFlow('?method=bank')
        act(() => r2.current.handleCountryClick(GERMANY as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany')
    })

    it('renders the flow on a corridor, and returns to the countries when it asks for the list', async () => {
        const { result } = renderFlow('?method=bank&corridor=SEPA_EU&step=details')
        expect(result.current.showsDepositAccounts).toBe(true)
        expect(result.current.isBareRoot).toBe(false)

        const updates: UrlUpdateEvent[] = []
        const { result: r2 } = renderFlow('?method=bank&corridor=SEPA_EU&step=list', (e) => updates.push(e))
        // the deposit-accounts list is not a second discovery surface here
        expect(r2.current.showsDepositAccounts).toBe(false)
        // both params are dropped, so what is left is the country list itself
        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBeNull())
        expect(updates.at(-1)?.searchParams.get('step')).toBeNull()
        expect(updates.at(-1)?.searchParams.get('method')).toBe('bank')
    })
})
