import { renderHook } from '@testing-library/react'
import { useScrollTopOnNavigation } from '../useScrollTopOnNavigation'

let mockPathname = '/profile'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

// TASK-23929 item 5: the window is the app's scroller, and a page opened from a
// scrolled one (Profile → Card) kept that scroll position
describe('useScrollTopOnNavigation', () => {
    const scrollTo = jest.fn()
    beforeEach(() => {
        mockPathname = '/profile'
        scrollTo.mockClear()
        window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    })

    it('leaves the first page where it is', () => {
        renderHook(() => useScrollTopOnNavigation())
        expect(scrollTo).not.toHaveBeenCalled()
    })

    it('opens a new page at its top', () => {
        const { rerender } = renderHook(() => useScrollTopOnNavigation())
        mockPathname = '/card'
        rerender()
        expect(scrollTo).toHaveBeenCalledWith(0, 0)
    })

    it('keeps the position the browser restores on back and forward', () => {
        const { rerender } = renderHook(() => useScrollTopOnNavigation())
        window.history.replaceState(null, '', '/home')
        window.dispatchEvent(new PopStateEvent('popstate'))
        mockPathname = '/home'
        rerender()
        expect(scrollTo).not.toHaveBeenCalled()

        mockPathname = '/card'
        rerender()
        expect(scrollTo).toHaveBeenCalledWith(0, 0)
    })

    it('still resets on the next link after a Back that changed only the query', () => {
        const { rerender } = renderHook(() => useScrollTopOnNavigation())
        window.history.replaceState(null, '', '/profile?step=2')
        window.dispatchEvent(new PopStateEvent('popstate'))
        rerender()
        mockPathname = '/card'
        rerender()
        expect(scrollTo).toHaveBeenCalledWith(0, 0)
    })
})
