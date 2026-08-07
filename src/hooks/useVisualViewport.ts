import { useEffect, useState } from 'react'

/**
 * Sub-pixel rounding and desktop scrollbars leave a few px between the layout and
 * visual viewports with nothing on screen. Set below the ~45px accessory bar iOS
 * shows for a hardware keyboard — that bar covers a composer just as effectively as
 * the full keyboard does — but well above scrollbar and rounding noise.
 */
const MIN_KEYBOARD_INSET_PX = 40

/** Nothing is measured while unsupported, disabled, or zoomed — consumers fall back to CSS. */
const UNMEASURED: VisualViewportState = { height: 0, keyboardInset: 0 }

export interface VisualViewportState {
    /** Height actually on screen, in px. `0` when unmeasured (see {@link UNMEASURED}). */
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
    const [state, setState] = useState<VisualViewportState>(UNMEASURED)

    useEffect(() => {
        const commit = (next: VisualViewportState) =>
            setState((prev) => (prev.height === next.height && prev.keyboardInset === next.keyboardInset ? prev : next))

        const viewport = typeof window === 'undefined' ? null : window.visualViewport
        if (!enabled || !viewport) {
            // Drop the last measurement rather than freeze it. A consumer that lifts by
            // `keyboardInset` has to come back down when it closes — and since we
            // unsubscribe here, we'd never see the keyboard leave.
            commit(UNMEASURED)
            return
        }

        const measure = () => {
            // Pinch-zoom shrinks the visual viewport too, and a zoomed reader is not
            // typing — adjusting for it just makes things jump. `maximum-scale=1` in the
            // root viewport keeps iOS from auto-zooming on focus, so scale > 1 is always
            // a deliberate pinch and never a keyboard.
            if (viewport.scale > 1) return commit(UNMEASURED)

            // The still-visible slice of the layout viewport is
            // [offsetTop, offsetTop + height] — offsetTop goes non-zero once iOS
            // scrolls the focused field into view. Whatever is below that slice is
            // where a `bottom: 0` fixed element lands: behind the keyboard.
            const hidden = window.innerHeight - viewport.height - viewport.offsetTop
            commit({
                height: viewport.height,
                keyboardInset: hidden > MIN_KEYBOARD_INSET_PX ? hidden : 0,
            })
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
