/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()

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
    getRedirectUrl: jest.fn(() => null),
    clearRedirectUrl: jest.fn(),
    getFromLocalStorage: jest.fn(() => null),
    // real behavior: same-origin paths pass, everything else is rejected
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

jest.mock('@/utils/regions.utils', () => ({
    isBridgeSupportedCountry: (id: string) => ['DE', 'US'].includes(id),
}))

jest.mock('@/constants/manteca.consts', () => ({
    isMantecaSupportedCountryCode: (id: string) => ['AR', 'BR'].includes(id),
}))

jest.mock('@/utils/native-routes', () => ({
    addMoneyCountryUrl: (path: string) => `/add-money/${path}`,
    rewriteMethodPath: (path: string) => path,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { DEPOSIT_METHOD_SELECTED: 'deposit_method_selected' },
}))

import { useAddMoneyFlow } from '../useAddMoneyFlow'

const renderFlow = (search = '', onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    renderHook(() => useAddMoneyFlow(), { wrapper: withNuqsTestingAdapter({ searchParams: search, onUrlUpdate }) })

describe('useAddMoneyFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
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

    it('back from a country sub-view writes the bank country list params in place', async () => {
        const events: UrlUpdateEvent[] = []
        const { result } = renderFlow('?country=austria', (e) => events.push(e))
        expect(mockResetOnrampFlow).not.toHaveBeenCalled()

        act(() => result.current.handleBack())
        await waitFor(() => expect(events.length).toBeGreaterThan(0))

        const last = events.at(-1)
        expect(last?.searchParams.get('country')).toBeNull()
        expect(last?.searchParams.get('method')).toBe('bank')
        // history entry preserved, as with the old router.push
        expect(last?.options.history).toBe('push')
        expect(mockRouterPush).not.toHaveBeenCalled()
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
})
