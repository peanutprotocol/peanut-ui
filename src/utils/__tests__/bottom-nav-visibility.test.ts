import { act, renderHook } from '@testing-library/react'
import {
    acquireBottomNavHide,
    resetBottomNavVisibilityForTests,
    useBottomNavHidden,
} from '@/utils/bottom-nav-visibility'

describe('bottom-nav visibility store', () => {
    beforeEach(() => {
        resetBottomNavVisibilityForTests()
    })

    it('is visible by default', () => {
        const { result } = renderHook(() => useBottomNavHidden())
        expect(result.current).toBe(false)
    })

    it('hides while a hold is acquired and shows again on release', () => {
        const { result } = renderHook(() => useBottomNavHidden())

        let release: () => void = () => {}
        act(() => {
            release = acquireBottomNavHide()
        })
        expect(result.current).toBe(true)

        act(() => release())
        expect(result.current).toBe(false)
    })

    it('stays hidden until every hold is released', () => {
        const { result } = renderHook(() => useBottomNavHidden())

        let releaseA: () => void = () => {}
        let releaseB: () => void = () => {}
        act(() => {
            releaseA = acquireBottomNavHide()
            releaseB = acquireBottomNavHide()
        })
        expect(result.current).toBe(true)

        act(() => releaseA())
        expect(result.current).toBe(true)

        act(() => releaseB())
        expect(result.current).toBe(false)
    })

    it('ignores a double release', () => {
        const { result } = renderHook(() => useBottomNavHidden())

        let releaseA: () => void = () => {}
        act(() => {
            releaseA = acquireBottomNavHide()
            acquireBottomNavHide()
        })
        act(() => {
            releaseA()
            releaseA()
        })
        expect(result.current).toBe(true)
    })

    it('resetBottomNavVisibilityForTests clears outstanding holds', () => {
        const { result } = renderHook(() => useBottomNavHidden())
        act(() => {
            acquireBottomNavHide()
        })
        act(() => resetBottomNavVisibilityForTests())
        expect(result.current).toBe(false)
    })
})
