import { heightAboveBottomNav, scrollClearOfBottomNav } from '../bottom-nav-clearance.utils'

const elementAt = (bottom: number) =>
    ({ getBoundingClientRect: () => ({ bottom }) as DOMRect }) as unknown as HTMLElement

describe('scrollClearOfBottomNav', () => {
    const scrollBy = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 667 })
        window.scrollBy = scrollBy as unknown as typeof window.scrollBy
        document.documentElement.style.removeProperty('--safe-bottom')
    })

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
