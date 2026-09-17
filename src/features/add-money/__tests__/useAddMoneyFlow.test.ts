/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'

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

jest.mock('@/utils/general.utils', () => ({
    getStoredRedirect: mockGetStoredRedirect,
    clearRedirectUrl: mockClearRedirectUrl,
    getFromLocalStorage: mockGetFromLocalStorage,
    // real behavior: same-origin paths pass, everything else is rejected
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

import { useAddMoneyFlow } from '../useAddMoneyFlow'

const renderFlow = (search = '') =>
    renderHook(() => useAddMoneyFlow(), { wrapper: withNuqsTestingAdapter({ searchParams: search }) })

describe('useAddMoneyFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetStoredRedirect.mockReturnValue(null)
        mockGetFromLocalStorage.mockReturnValue(null)
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

    /**
     * A link into one corridor is a link into the hub, not a bare root. Sending
     * it to the home drawer would drop the corridor the link named.
     */
    it('a corridor link opens the hub rather than the drawer', () => {
        const { result } = renderFlow('?corridor=SEPA_EU&step=details')
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
})
