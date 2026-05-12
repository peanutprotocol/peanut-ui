import { renderHook, act } from '@testing-library/react'
import { useSafeBack, __testing } from '@/hooks/useSafeBack'

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
