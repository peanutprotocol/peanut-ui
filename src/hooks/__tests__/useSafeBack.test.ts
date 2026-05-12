import { renderHook, act } from '@testing-library/react'
import { useSafeBack, installNavTracker, __testing } from '@/hooks/useSafeBack'

const mockBack = jest.fn()
const mockPush = jest.fn()
// Stable router object across calls — matches real Next.js semantics. Without this, every
// useRouter() call would return a fresh reference and useCallback would invalidate every render.
const mockRouter = {
    back: mockBack,
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
}

jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}))

// installNavTracker patches window.history.pushState once per page load. Reset the patch
// (and the captured original) between every test so each case starts from a clean global.
let originalPushState: typeof window.history.pushState
beforeEach(() => {
    mockBack.mockReset()
    mockPush.mockReset()
    if (!originalPushState) originalPushState = window.history.pushState.bind(window.history)
    window.history.pushState = originalPushState
    __testing.reset()
})

describe('useSafeBack', () => {
    it('falls back to push(fallbackUrl) when no in-app navigation has occurred (cold deep-link)', () => {
        installNavTracker()

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('calls router.back() once an in-app pushState has happened', () => {
        installNavTracker()
        // Simulate an in-app navigation — Next.js + nuqs both go through pushState.
        act(() => {
            window.history.pushState({}, '', '/some-route')
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('decrements on popstate so an over-pop falls back to fallbackUrl', () => {
        installNavTracker()
        act(() => {
            window.history.pushState({}, '', '/screen-a')
        })
        expect(__testing.getCount()).toBe(1)

        // User pressed browser back: popstate fires, counter drops to 0.
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
        })
        expect(__testing.getCount()).toBe(0)

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        // No in-app entries left to pop → fallback.
        expect(mockPush).toHaveBeenCalledWith('/home')
        expect(mockBack).not.toHaveBeenCalled()
    })

    it('clamps count at 0 — extra popstates do not go negative', () => {
        installNavTracker()
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
            window.dispatchEvent(new PopStateEvent('popstate'))
            window.dispatchEvent(new PopStateEvent('popstate'))
        })
        expect(__testing.getCount()).toBe(0)
    })

    it('install is idempotent — calling it twice does not double-patch pushState', () => {
        installNavTracker()
        const afterFirst = window.history.pushState
        installNavTracker()
        const afterSecond = window.history.pushState

        expect(afterFirst).toBe(afterSecond)

        // And the counter increments by one (not two) on a single pushState call.
        act(() => {
            window.history.pushState({}, '', '/x')
        })
        expect(__testing.getCount()).toBe(1)
    })

    it('counter survives nuqs-style query-only pushes', () => {
        installNavTracker()
        // nuqs with { history: 'push' } pushes a same-pathname URL with new query.
        act(() => {
            window.history.pushState({}, '', '/screen?step=1')
            window.history.pushState({}, '', '/screen?step=2')
        })

        const { result } = renderHook(() => useSafeBack('/home'))
        act(() => result.current())

        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('returned callback is stable when router and fallback do not change', () => {
        installNavTracker()
        const { result, rerender } = renderHook(({ url }: { url: string }) => useSafeBack(url), {
            initialProps: { url: '/home' },
        })
        const first = result.current
        rerender({ url: '/home' })
        expect(result.current).toBe(first)
    })

    it('returned callback changes when fallbackUrl changes', () => {
        installNavTracker()
        const { result, rerender } = renderHook(({ url }: { url: string }) => useSafeBack(url), {
            initialProps: { url: '/home' },
        })
        const first = result.current
        rerender({ url: '/withdraw' })
        expect(result.current).not.toBe(first)

        act(() => result.current())
        expect(mockPush).toHaveBeenCalledWith('/withdraw')
    })
})
