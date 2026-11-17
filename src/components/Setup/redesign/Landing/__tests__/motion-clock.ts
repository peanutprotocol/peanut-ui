/**
 * A hand-driven stand-in for the shared mascot clock (`subscribeToMascotClock`), so a suite can step the X1 walk
 * frame by frame. Wire it with:
 *   jest.mock('@/components/Global/PeanutMascot/PeanutMascot.utils', () => require('./motion-clock').clockModule())
 */
export const clock = { tickers: new Set<(deltaSeconds: number) => void>() }

export const clockModule = () => ({
    ...jest.requireActual('@/components/Global/PeanutMascot/PeanutMascot.utils'),
    subscribeToMascotClock: (tick: (deltaSeconds: number) => void) => {
        clock.tickers.add(tick)
        return () => {
            clock.tickers.delete(tick)
        }
    },
})

/** Every coin's translateX in px, read from the coin band's children (band x is 0 at 390 wide). */
export function coinOffsets(band: HTMLElement): number[] {
    return Array.from(band.querySelectorAll<HTMLElement>('[style*="translate"]')).map((coin) => {
        const match = /translateX\((-?[\d.]+)px\)/.exec(coin.style.transform)
        return match ? Number(match[1]) : Number.NaN
    })
}

/**
 * Sets `prefers-reduced-motion: reduce` for this file. jest.setup.ts defines matchMedia as writable but not
 * configurable, so it is assigned, not redefined.
 */
export function setReducedMotionQuery(on: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: on && query.includes('prefers-reduced-motion') && query.includes('reduce'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia
}
