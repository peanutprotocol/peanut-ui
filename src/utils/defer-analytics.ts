/**
 * Run analytics work once the browser is idle instead of during page load.
 *
 * Nothing is dropped: the callback is also fired on `pagehide`, so a visitor who
 * leaves before the browser ever goes idle still gets the work done rather than
 * disappearing from the numbers. `requestIdleCallback`'s timeout bounds the wait
 * so it always runs on a busy main thread too.
 */
export function whenIdle(run: () => void, timeout = 3000): void {
    if (typeof window === 'undefined') return

    let fired = false
    const fire = () => {
        if (fired) return
        fired = true
        window.removeEventListener('pagehide', fire)
        run()
    }

    window.addEventListener('pagehide', fire)

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fire, { timeout })
    } else {
        window.setTimeout(fire, timeout)
    }
}
