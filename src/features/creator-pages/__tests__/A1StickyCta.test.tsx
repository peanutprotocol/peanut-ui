/** @jest-environment jsdom */
import { act, render } from '@testing-library/react'
import { NitaA1 } from '../pages/juanacervio/NitaA1'
import { creatorPageFixture } from '../preview-fixture'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), set_config: jest.fn(), config: {} },
}))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: () => false }))

/** Stands in for the browser's observer: the test says how much of each button is on screen (0 to 1). */
class FakeIntersectionObserver {
    static last: FakeIntersectionObserver | null = null
    observed: Element[] = []
    disconnected = false
    constructor(
        private callback: IntersectionObserverCallback,
        readonly options?: IntersectionObserverInit
    ) {
        FakeIntersectionObserver.last = this
    }
    observe(element: Element) {
        this.observed.push(element)
    }
    unobserve() {}
    disconnect() {
        this.disconnected = true
    }
    takeRecords() {
        return []
    }
    report(changes: [Element, number][]) {
        const entries = changes.map(([target, intersectionRatio]) => ({
            target,
            intersectionRatio,
            isIntersecting: intersectionRatio > 0,
        }))
        act(() => this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver))
    }
}

const realObserver = global.IntersectionObserver
beforeEach(() => {
    FakeIntersectionObserver.last = null
    global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
})
afterEach(() => {
    global.IntersectionObserver = realObserver
})

function renderA1() {
    const view = render(<NitaA1 {...creatorPageFixture('juanacervio', 'a1')} deviceOs="ios" liftCta={false} />)
    const stickyButton = view.container.querySelector('[data-cta-position="sticky"]')!
    const bar = stickyButton.parentElement!
    const hero = view.container.querySelector('[data-cta-position="hero"]')!
    const footer = view.container.querySelector('[data-cta-position="footer"]')!
    return { ...view, bar, hero, footer, observer: FakeIntersectionObserver.last! }
}

describe('A1StickyCta', () => {
    it('watches the in-page buttons of its own page, and not itself', () => {
        const { hero, footer, observer } = renderA1()
        expect(observer.observed).toEqual([hero, footer])
    })

    it('asks the browser to report when a button is almost fully on screen', () => {
        const { observer } = renderA1()
        // A 48px button at this share shows at least 44px, the height a finger needs.
        expect(Number(observer.options?.threshold) * 48).toBeGreaterThanOrEqual(44)
        // The exact share is pinned: the hand-over rule waits on an owner ruling, so it must not drift.
        expect(observer.options?.threshold).toBe(0.95)
    })

    it('does not count a button in the bottom 100px of the screen as on screen', () => {
        // An in-app browser can draw its controls over that part of the page, and the page cannot see
        // them: a button there may be covered, so the bar stays up until the button is above it.
        expect(renderA1().observer.options?.rootMargin).toBe('0px 0px -100px 0px')
    })

    it('starts hidden until the browser reports where the buttons are', () => {
        expect(renderA1().bar).toHaveAttribute('data-state', 'hidden')
    })

    it('carries the invitation line under its button', () => {
        const { bar } = renderA1()
        expect(bar.lastElementChild).toHaveTextContent('Con la invitación de Nita')
    })

    it('shows while only a part of the post button is above the bottom 100px (the first screen of a 320×568 phone)', () => {
        const { bar, hero, footer, observer } = renderA1()
        observer.report([
            [hero, 0.1],
            [footer, 0],
        ])
        expect(bar).toHaveAttribute('data-state', 'shown')
    })

    it('hides only while an in-page button is fully on screen, so one whole button always shows and never two', () => {
        const { bar, hero, footer, observer } = renderA1()

        observer.report([
            [hero, 1],
            [footer, 0],
        ])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        // The post button starts to leave the screen: 43 of its 48px are left, too little to count.
        observer.report([[hero, 0.9]])
        expect(bar).toHaveAttribute('data-state', 'shown')

        observer.report([[hero, 0]])
        expect(bar).toHaveAttribute('data-state', 'shown')

        // The closing button comes into view: the bar stays until that button is whole.
        observer.report([[footer, 0.5]])
        expect(bar).toHaveAttribute('data-state', 'shown')
        observer.report([[footer, 1]])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        // Both whole on a tall phone, then one leaves: still one whole button on screen.
        observer.report([[hero, 1]])
        observer.report([[footer, 0.3]])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        observer.report([[hero, 0.3]])
        expect(bar).toHaveAttribute('data-state', 'shown')
    })

    it('stops watching when the page goes away', () => {
        const { unmount, observer } = renderA1()
        unmount()
        expect(observer.disconnected).toBe(true)
    })
})
