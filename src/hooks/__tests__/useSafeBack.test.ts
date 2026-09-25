import { renderHook, act } from '@testing-library/react'
import { hasInAppHistory, useReturnTo, useSafeBack, __testing } from '@/hooks/useSafeBack'

const mockBack = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace, prefetch: jest.fn() }

jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}))

beforeEach(() => {
    mockBack.mockReset()
    mockPush.mockReset()
    mockReplace.mockReset()
    __testing.reset()
})

describe('useSafeBack', () => {
    it('pushes fallback on cold deep-link (no in-app history)', () => {
        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('calls router.back() after an in-app pushState', () => {
        act(() => {
            window.history.pushState({}, '', '/some-route')
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('falls back again after popstate drains the counter', () => {
        act(() => {
            window.history.pushState({}, '', '/screen-a')
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('clamps the counter at 0 — extra popstates do not go negative', () => {
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockPush).toHaveBeenCalledWith('/home')
    })

    it('counts nuqs-style same-path query pushes', () => {
        act(() => {
            window.history.pushState({}, '', '/screen?step=1')
            window.history.pushState({}, '', '/screen?step=2')
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockBack).toHaveBeenCalledTimes(1)
    })

    it('with { replace: true }, uses router.replace for the no-history fallback', () => {
        const { result } = renderHook(() => useSafeBack('/home', { replace: true }))
        act(() => result.current())

        expect(mockReplace).toHaveBeenCalledWith('/home')
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('with { replace: true }, still calls router.back() when in-app history exists', () => {
        act(() => {
            window.history.pushState({}, '', '/some-route')
        })

        const { result } = renderHook(() => useSafeBack('/home', { replace: true }))
        act(() => result.current())

        // replace only affects the fallback branch — back() is unchanged.
        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('useReturnTo', () => {
    let go: jest.SpyInstance
    beforeEach(() => {
        window.history.replaceState({}, '', '/')
        go = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
    })
    afterEach(() => go.mockRestore())

    // Profile → Accounts and payments → account details. Pushing the origin
    // made history [.., accounts, details, accounts], and back from accounts
    // (useSafeBack → router.back()) reopened details: a loop.
    it('rewinds to the origin when it is behind the current entry, never pushes it', () => {
        act(() => {
            window.history.pushState({}, '', '/profile')
            window.history.pushState({}, '', '/profile/accounts-and-payments')
            window.history.pushState({}, '', '/add-money?method=bank&step=details')
        })

        const { result } = renderHook(() => useReturnTo('/profile/accounts-and-payments'))
        act(() => result.current())

        expect(go).toHaveBeenCalledWith(-1)
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('rewinds past every page the flow pushed, to the nearest entry on the origin path', () => {
        act(() => {
            window.history.pushState({}, '', '/home?drawer=add')
            window.history.pushState({}, '', '/add-money?method=bank')
            window.history.pushState({}, '', '/add-money/mexico/bank')
        })

        const { result } = renderHook(() => useReturnTo('/home'))
        act(() => result.current())

        // current: the country page; behind it the hub, then home
        expect(go).toHaveBeenCalledWith(-2)
    })

    it('keeps the history mirror in step: the rewind popstate does not pop it twice', () => {
        act(() => {
            window.history.pushState({}, '', '/profile')
            window.history.pushState({}, '', '/withdraw')
        })
        const { result } = renderHook(() => useReturnTo('/profile'))
        act(() => result.current())
        // the one popstate history.go(-1) fires
        act(() => window.dispatchEvent(new PopStateEvent('popstate')))

        // '/' is still behind '/profile', so back stays in the app
        expect(hasInAppHistory()).toBe(true)
    })

    it('replaces the current page with the origin when the origin is not in in-app history', () => {
        act(() => {
            window.history.pushState({}, '', '/withdraw')
        })

        const { result } = renderHook(() => useReturnTo('/profile/exchange-rate'))
        act(() => result.current())

        expect(go).not.toHaveBeenCalled()
        expect(mockReplace).toHaveBeenCalledWith('/profile/exchange-rate')
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('hasInAppHistory', () => {
    it('is false on a cold entry and true after an in-app push', () => {
        expect(hasInAppHistory()).toBe(false)
        act(() => {
            window.history.pushState({}, '', '/history')
        })
        expect(hasInAppHistory()).toBe(true)
    })
})
