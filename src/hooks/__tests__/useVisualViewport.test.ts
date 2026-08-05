/**
 * useVisualViewport — the keyboard measurement behind the support drawer's lift.
 *
 * The bug it guards: on iOS the layout viewport never shrinks for the software
 * keyboard, so a `position: fixed; bottom: 0` drawer keeps its bottom edge — and
 * the Crisp composer sitting on it — underneath the keys. The only signal that
 * this happened is the gap between `window.innerHeight` and the visual viewport.
 */
import { renderHook, act } from '@testing-library/react'
import { useVisualViewport } from '../useVisualViewport'

const LAYOUT_HEIGHT = 800

// jsdom implements no visualViewport at all — stand up a controllable stub.
class FakeVisualViewport extends EventTarget {
    height = LAYOUT_HEIGHT
    offsetTop = 0
}

let viewport: FakeVisualViewport

const setViewport = (height: number, offsetTop = 0) => {
    viewport.height = height
    viewport.offsetTop = offsetTop
    act(() => {
        viewport.dispatchEvent(new Event('resize'))
    })
}

beforeEach(() => {
    viewport = new FakeVisualViewport()
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: LAYOUT_HEIGHT, configurable: true })
})

describe('useVisualViewport', () => {
    it('reports no keyboard when the visual viewport fills the layout viewport', () => {
        const { result } = renderHook(() => useVisualViewport(true))

        expect(result.current).toEqual({ height: LAYOUT_HEIGHT, keyboardInset: 0 })
    })

    it('reports the covered height once the keyboard opens', () => {
        const { result } = renderHook(() => useVisualViewport(true))

        setViewport(460)

        expect(result.current).toEqual({ height: 460, keyboardInset: 340 })
    })

    it('counts the scroll iOS performs to reveal the focused field', () => {
        // iOS scrolls the visual viewport down over the layout viewport; the drawer is
        // pinned to the layout viewport, so that offset hides it too.
        const { result } = renderHook(() => useVisualViewport(true))

        setViewport(460, 100)

        expect(result.current.keyboardInset).toBe(240)
    })

    it('ignores sub-pixel / scrollbar deltas that are not a keyboard', () => {
        const { result } = renderHook(() => useVisualViewport(true))

        setViewport(799.4)

        expect(result.current.keyboardInset).toBe(0)
    })

    it('does not measure or subscribe while disabled', () => {
        const subscribe = jest.spyOn(viewport, 'addEventListener')

        const { result } = renderHook(() => useVisualViewport(false))

        expect(result.current).toEqual({ height: 0, keyboardInset: 0 })
        expect(subscribe).not.toHaveBeenCalled()
    })

    it('unsubscribes on unmount', () => {
        const unsubscribe = jest.spyOn(viewport, 'removeEventListener')

        const { unmount } = renderHook(() => useVisualViewport(true))
        unmount()

        expect(unsubscribe).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(unsubscribe).toHaveBeenCalledWith('scroll', expect.any(Function))
    })

    it('survives a browser with no visualViewport', () => {
        Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })

        const { result } = renderHook(() => useVisualViewport(true))

        expect(result.current).toEqual({ height: 0, keyboardInset: 0 })
    })
})
