/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'

const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
let mockSearchParams = new URLSearchParams()
let mockMethod: string | null = null

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace, back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => mockSearchParams,
}))

jest.mock('nuqs', () => ({
    useQueryState: () => [mockMethod, jest.fn()],
    parseAsStringEnum: () => ({}),
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

describe('useAddMoneyFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockSearchParams = new URLSearchParams()
        mockMethod = null
    })

    it('bare root redirects to the home add drawer and resets onramp state', () => {
        renderHook(() => useAddMoneyFlow())
        expect(mockResetOnrampFlow).toHaveBeenCalled()
        expect(mockRouterReplace).toHaveBeenCalledWith('/home?drawer=add')
    })

    it('bare root carries a same-origin returnTo, drops an off-origin one', () => {
        mockSearchParams = new URLSearchParams({ returnTo: '/profile/exchange-rate' })
        renderHook(() => useAddMoneyFlow())
        expect(mockRouterReplace).toHaveBeenCalledWith(
            `/home?drawer=add&returnTo=${encodeURIComponent('/profile/exchange-rate')}`
        )

        mockRouterReplace.mockClear()
        mockSearchParams = new URLSearchParams({ returnTo: 'https://evil.example/phish' })
        renderHook(() => useAddMoneyFlow())
        expect(mockRouterReplace).toHaveBeenCalledWith('/home?drawer=add')
    })

    it('?method=bank is not bare root and does not redirect', () => {
        mockMethod = 'bank'
        const { result } = renderHook(() => useAddMoneyFlow())
        expect(result.current.isBareRoot).toBe(false)
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('back honours a same-origin returnTo, resets to /home otherwise', () => {
        mockMethod = 'bank'
        mockSearchParams = new URLSearchParams({ returnTo: '/profile/exchange-rate' })
        const { result } = renderHook(() => useAddMoneyFlow())
        act(() => result.current.handleBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate')

        mockRouterPush.mockClear()
        mockSearchParams = new URLSearchParams()
        const { result: r2 } = renderHook(() => useAddMoneyFlow())
        act(() => r2.current.handleBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    it('back from a country sub-view returns to the bank country list', () => {
        mockMethod = 'bank'
        mockSearchParams = new URLSearchParams({ country: 'austria' })
        const { result } = renderHook(() => useAddMoneyFlow())
        expect(mockResetOnrampFlow).not.toHaveBeenCalled()
        act(() => result.current.handleBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money?method=bank')
    })

    it('routes a country click to manteca, bridge bank, or the per-country screen', () => {
        mockMethod = 'bank'
        const { result } = renderHook(() => useAddMoneyFlow())

        act(() => result.current.handleCountryClick({ id: 'AR', path: 'argentina' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/argentina/manteca')

        act(() => result.current.handleCountryClick({ id: 'DE', path: 'germany' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')

        act(() => result.current.handleCountryClick({ id: 'TD', path: 'chad' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/chad')
        expect(mockCapture).toHaveBeenCalledTimes(3)
    })
})
