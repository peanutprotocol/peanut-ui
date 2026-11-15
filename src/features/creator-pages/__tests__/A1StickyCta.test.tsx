/** @jest-environment jsdom */
import { act, render } from '@testing-library/react'
import { NitaA1 } from '../pages/juanacervio/NitaA1'
import { creatorPageFixture } from '../preview-fixture'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: () => false }))

/** Stands in for the browser's observer: the test says which buttons are on screen. */
class FakeIntersectionObserver {
    static last: FakeIntersectionObserver | null = null
    observed: Element[] = []
    disconnected = false
    constructor(private callback: IntersectionObserverCallback) {
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
    report(changes: [Element, boolean][]) {
        const entries = changes.map(([target, isIntersecting]) => ({ target, isIntersecting }))
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
    const view = render(<NitaA1 {...creatorPageFixture('juanacervio', 'a1')} deviceOs="ios" />)
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

    it('starts hidden: the first screen holds the button in the post', () => {
        expect(renderA1().bar).toHaveAttribute('data-state', 'hidden')
    })

    it('stays hidden while any in-page button is on screen, and shows when none is', () => {
        const { bar, hero, footer, observer } = renderA1()

        observer.report([
            [hero, true],
            [footer, false],
        ])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        // Scrolled past the post: no in-page button on screen.
        observer.report([[hero, false]])
        expect(bar).toHaveAttribute('data-state', 'shown')

        // The closing button comes into view.
        observer.report([[footer, true]])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        // Both on screen on a tall phone, then one leaves: still one on screen.
        observer.report([[hero, true]])
        observer.report([[footer, false]])
        expect(bar).toHaveAttribute('data-state', 'hidden')

        observer.report([[hero, false]])
        expect(bar).toHaveAttribute('data-state', 'shown')
    })

    it('stops watching when the page goes away', () => {
        const { unmount, observer } = renderA1()
        unmount()
        expect(observer.disconnected).toBe(true)
    })
})
