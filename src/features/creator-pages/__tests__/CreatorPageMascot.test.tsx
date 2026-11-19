/** @jest-environment jsdom */
import { act, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { CreatorPageMascot } from '../CreatorPageMascot'

jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose }: { pose: string }) => <div data-mascot-pose={pose} />,
}))

/** Stands in for the browser's observer: the test says when the mascot comes near the screen. */
class FakeIntersectionObserver {
    static last: FakeIntersectionObserver | null = null
    constructor(
        private callback: IntersectionObserverCallback,
        readonly options?: IntersectionObserverInit
    ) {
        FakeIntersectionObserver.last = this
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
    near(isIntersecting: boolean) {
        act(() =>
            this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
        )
    }
}

const realObserver = global.IntersectionObserver
const realMatchMedia = window.matchMedia
function prefersReducedMotion(matches: boolean) {
    window.matchMedia = ((query: string) => ({ ...realMatchMedia(query), matches })) as typeof window.matchMedia
}
beforeEach(() => {
    FakeIntersectionObserver.last = null
    global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    prefersReducedMotion(false)
})
afterEach(() => {
    global.IntersectionObserver = realObserver
    window.matchMedia = realMatchMedia
})

describe('CreatorPageMascot', () => {
    it('sends the approved sitting still in the first HTML, and no loop', () => {
        const html = renderToString(<CreatorPageMascot />)
        expect(html).toContain('<img')
        expect(html).not.toContain('data-mascot-pose')
    })

    it('starts the pointing-down loop only once the mascot comes near the screen', () => {
        const { container } = render(<CreatorPageMascot />)
        expect(container.querySelector('[data-mascot-pose]')).toBeNull()

        FakeIntersectionObserver.last!.near(false)
        expect(container.querySelector('[data-mascot-pose]')).toBeNull()

        FakeIntersectionObserver.last!.near(true)
        expect(container.querySelector('[data-mascot-pose="pointing-down"]')).not.toBeNull()
        // The still stays under the loop until the loop has drawn its first frame.
        expect(container.querySelector('img')).not.toBeNull()
    })

    it('keeps the still and never loads the loop under reduced motion', () => {
        prefersReducedMotion(true)
        const { container } = render(<CreatorPageMascot />)
        expect(FakeIntersectionObserver.last).toBeNull()
        expect(container.querySelector('[data-mascot-pose]')).toBeNull()
        expect(container.querySelector('img')).not.toBeNull()
    })
})
