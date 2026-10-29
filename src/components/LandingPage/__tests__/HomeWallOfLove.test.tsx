import { act, fireEvent, render } from '@testing-library/react'
import { WALL_OF_LOVE_POSTS } from '@/constants/tweets.consts'
import { HomeWallOfLove } from '../HomeWallOfLove'
import { WALL_OF_LOVE_STEP_MS } from '../homeWallOfLove.consts'

type IoCallback = (entries: Partial<IntersectionObserverEntry>[]) => void
let ioCallbacks: IoCallback[] = []
let reducedMotion = false
const OriginalIo = global.IntersectionObserver
const originalMatchMedia = window.matchMedia

beforeEach(() => {
    jest.useFakeTimers()
    ioCallbacks = []
    reducedMotion = false
    global.IntersectionObserver = class {
        constructor(callback: IoCallback) {
            ioCallbacks.push(callback)
        }
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() {
            return []
        }
    } as unknown as typeof IntersectionObserver
    window.matchMedia = ((query: string) => ({
        matches: query.includes('reduce') && reducedMotion,
        media: query,
        // framer-motion's reduced-motion check still uses the old listener API
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    })) as unknown as typeof window.matchMedia
})

afterEach(() => {
    jest.useRealTimers()
    global.IntersectionObserver = OriginalIo
    window.matchMedia = originalMatchMedia
})

const shownHandles = (container: HTMLElement) =>
    Array.from(
        container.querySelectorAll('[data-shown="true"] a'),
        (a) => WALL_OF_LOVE_POSTS.find((post) => post.url === a.getAttribute('href'))?.handle
    )

const scrollIntoView = () => act(() => ioCallbacks.forEach((cb) => cb([{ isIntersecting: true }])))
const step = () => act(() => jest.advanceTimersByTime(WALL_OF_LOVE_STEP_MS))

describe('HomeWallOfLove', () => {
    const renderWall = () =>
        render(
            <HomeWallOfLove heading="Wall of love." pauseLabel="Pause" playLabel="Play" posts={WALL_OF_LOVE_POSTS} />
        )
    const first = WALL_OF_LOVE_POSTS.slice(0, 3).map((p) => p.handle)

    it('keeps every curated post in the page, three shown at first in curated order', () => {
        const { container } = renderWall()
        expect(container.querySelectorAll('a')).toHaveLength(WALL_OF_LOVE_POSTS.length)
        expect(shownHandles(container)).toEqual(first)
    })

    it('stays still until the wall is on screen, then swaps one slot per step', () => {
        const { container } = renderWall()
        step()
        expect(shownHandles(container)).toEqual(first)
        scrollIntoView()
        step()
        expect(shownHandles(container)).toEqual([WALL_OF_LOVE_POSTS[3].handle, first[1], first[2]])
        step()
        step()
        expect(shownHandles(container)).toEqual(WALL_OF_LOVE_POSTS.slice(3, 6).map((p) => p.handle))
    })

    it('holds while a pointer is over the wall or focus is inside it', () => {
        const { container } = renderWall()
        scrollIntoView()
        const wall = container.querySelector('ul')!
        fireEvent.pointerEnter(wall)
        step()
        expect(shownHandles(container)).toEqual(first)
        fireEvent.pointerLeave(wall)
        fireEvent.focusIn(wall.querySelector('a')!)
        step()
        expect(shownHandles(container)).toEqual(first)
        fireEvent.focusOut(wall.querySelector('a')!)
        step()
        expect(shownHandles(container)).not.toEqual(first)
    })

    it('stops for good on Pause, so posts never change under a screen-reader cursor, and resumes on Play', () => {
        const { container, getByRole } = renderWall()
        scrollIntoView()
        fireEvent.click(getByRole('button', { name: 'Pause' }))
        step()
        step()
        step()
        expect(shownHandles(container)).toEqual(first)
        fireEvent.click(getByRole('button', { name: 'Play' }))
        scrollIntoView()
        step()
        expect(shownHandles(container)).not.toEqual(first)
    })

    it('never cycles under reduced motion', () => {
        reducedMotion = true
        const { container } = renderWall()
        scrollIntoView()
        step()
        step()
        expect(shownHandles(container)).toEqual(first)
    })
})
