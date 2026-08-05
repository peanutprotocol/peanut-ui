import { useEffect, useState } from 'react'

/**
 * Sub-pixel rounding and desktop scrollbars leave a few px between the layout and
 * visual viewports even with no keyboard on screen. No software keyboard is anywhere
 * near this short, so anything below the floor is measurement noise, not a keyboard.
 */
const MIN_KEYBOARD_INSET_PX = 80

export interface VisualViewportState {
    /** Height actually on screen, in px. `0` until measured (SSR, or unsupported). */
    height: number
    /** Px of the layout viewport's bottom edge hidden behind the software keyboard. */
    keyboardInset: number
}

/**
 * Measures the *visual* viewport — the slice of the page actually on screen.
 *
 * iOS never resizes the layout viewport for the software keyboard, so `100vh`,
 * `100dvh` and `position: fixed; bottom: 0` all keep pointing at the full,
 * keyboard-covered window. CSS therefore cannot see the keyboard at all; only
 * `window.visualViewport` knows how much of the screen it ate.
 *
 * Subscribes only while `enabled`, because these events fire on every
 * keystroke-driven scroll and consumers here are mounted on every route.
 */
export function useVisualViewport(enabled: boolean): VisualViewportState {
    const [state, setState] = useState<VisualViewportState>({ height: 0, keyboardInset: 0 })

    useEffect(() => {
        const viewport = typeof window === 'undefined' ? null : window.visualViewport
        if (!enabled || !viewport) return

        const measure = () => {
            // The still-visible slice of the layout viewport is
            // [offsetTop, offsetTop + height] — offsetTop goes non-zero once iOS
            // scrolls the focused field into view. Whatever is below that slice is
            // where a `bottom: 0` fixed element lands: behind the keyboard.
            const hidden = window.innerHeight - viewport.height - viewport.offsetTop
            const next: VisualViewportState = {
                height: viewport.height,
                keyboardInset: hidden > MIN_KEYBOARD_INSET_PX ? hidden : 0,
            }
            setState((prev) => (prev.height === next.height && prev.keyboardInset === next.keyboardInset ? prev : next))
        }

        measure()
        viewport.addEventListener('resize', measure)
        viewport.addEventListener('scroll', measure)
        return () => {
            viewport.removeEventListener('resize', measure)
            viewport.removeEventListener('scroll', measure)
        }
    }, [enabled])

    return state
}
