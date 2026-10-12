import { heightAboveBottomNav, scrollClearOfBottomNav } from '../bottom-nav-clearance.utils'

const elementAt = (bottom: number) =>
    ({ getBoundingClientRect: () => ({ bottom }) as DOMRect }) as unknown as HTMLElement

describe('scrollClearOfBottomNav', () => {
    const scrollBy = jest.fn()
    let now = 1_000_000
    beforeEach(() => {
        jest.clearAllMocks()
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 667 })
        window.scrollBy = scrollBy as unknown as typeof window.scrollBy
        document.documentElement.style.removeProperty('--safe-bottom')
        // each test starts long after any scroll a previous one asked for
        now += 10_000
        jest.spyOn(Date, 'now').mockImplementation(() => now)
    })

    afterEach(() => jest.restoreAllMocks())

    // 375x667: the nav owns 597-667 and the layout reserves 96px, so 571 is the lowest clear bottom
    it('moves the page by exactly the part hidden behind the nav', () => {
        scrollClearOfBottomNav(elementAt(620))
        expect(scrollBy).toHaveBeenCalledWith({ top: 49, behavior: 'smooth' })
    })

    it('leaves a page alone whose element already rests clear', () => {
        scrollClearOfBottomNav(elementAt(571))
        scrollClearOfBottomNav(elementAt(300))
        expect(scrollBy).not.toHaveBeenCalled()
    })

    it('counts the device safe area under the nav', () => {
        document.documentElement.style.setProperty('--safe-bottom', '34px')
        scrollClearOfBottomNav(elementAt(571))
        expect(scrollBy).toHaveBeenCalledWith({ top: 34, behavior: 'smooth' })
    })

    /*
     * A smooth scroll moves the page over several frames. A second call before
     * it lands measures the element where it still is, and used to scroll by
     * the whole distance again — past the target, on the CTA the first call was
     * bringing into view.
     */
    it('does not scroll twice for a scroll that is still travelling', () => {
        scrollClearOfBottomNav(elementAt(620))
        scrollClearOfBottomNav(elementAt(620))
        expect(scrollBy).toHaveBeenCalledTimes(1)
    })

    it('scrolls the rest of the way when the element moved further down meanwhile', () => {
        scrollClearOfBottomNav(elementAt(620))
        scrollClearOfBottomNav(elementAt(650))
        expect(scrollBy).toHaveBeenNthCalledWith(2, { top: 30, behavior: 'smooth' })
    })

    it('forgets a scroll that had its time, because the page is wherever it is', () => {
        scrollClearOfBottomNav(elementAt(620))
        now += 800
        scrollClearOfBottomNav(elementAt(620))
        expect(scrollBy).toHaveBeenNthCalledWith(2, { top: 49, behavior: 'smooth' })
    })

    it('does nothing without an element', () => {
        scrollClearOfBottomNav(null)
        expect(scrollBy).not.toHaveBeenCalled()
    })
})

describe('heightAboveBottomNav', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 667 })
        document.documentElement.style.removeProperty('--safe-bottom')
    })

    // a panel opening at y=300 on 375x667 can run to 571, the lowest clear line
    it('gives the room between the panel top and the nav', () => {
        expect(heightAboveBottomNav(300)).toBe(271)
    })

    it('gives nothing when the room is too small for a list, so the caller scrolls instead', () => {
        expect(heightAboveBottomNav(450)).toBeUndefined()
    })

    it('counts the device safe area', () => {
        document.documentElement.style.setProperty('--safe-bottom', '34px')
        expect(heightAboveBottomNav(300)).toBe(237)
    })
})
