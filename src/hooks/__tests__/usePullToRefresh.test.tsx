/**
 * usePullToRefresh — the feedback that tells a native user the pull worked.
 *
 * On native the refresh is a react-query invalidation rather than a page
 * reload, so nothing on screen blinks: if the indicator doesn't run the
 * arrow → spinner → checkmark sequence (with haptics), the gesture reads as
 * having done nothing at all.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePullToRefresh } from '../usePullToRefresh'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => true) }))
jest.mock('@/utils/haptics', () => ({
    impactHaptic: jest.fn(),
    notifyHaptic: jest.fn(),
}))

import { isCapacitor } from '@/utils/capacitor'
import { impactHaptic, notifyHaptic } from '@/utils/haptics'

// jsdom implements no Web Animations API — record calls so the spinner/check
// flourishes can be asserted without them throwing.
const animateCalls: { element: Element; keyframes: unknown }[] = []

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const indicator = () => document.querySelector<HTMLElement>('div[aria-hidden="true"]')
const iconHtml = () => indicator()?.firstElementChild?.innerHTML ?? ''

const touch = (type: string, clientY: number) => {
    const event = new Event(type, { bubbles: true }) as TouchEvent & { touches: unknown }
    Object.defineProperty(event, 'touches', {
        value: type === 'touchend' ? [] : [{ clientX: 0, clientY }],
    })
    act(() => {
        document.dispatchEvent(event)
    })
}

// pull past the release threshold: the hook damps the gesture by 0.5, so 200px
// of finger travel is 100px of pull against an 80px threshold
const pullPastThreshold = () => {
    touch('touchstart', 0)
    touch('touchmove', 200)
}

beforeEach(() => {
    jest.useFakeTimers()
    animateCalls.length = 0
    Element.prototype.animate = jest.fn(function (this: Element, keyframes: unknown) {
        animateCalls.push({ element: this, keyframes })
        return { cancel: jest.fn() } as unknown as Animation
    }) as unknown as Element['animate']
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // the layout's scroll container — the element that gets the settle fade
    const content = document.createElement('div')
    content.id = 'scrollable-content'
    document.body.appendChild(content)
    ;(isCapacitor as jest.Mock).mockReturnValue(true)
    jest.clearAllMocks()
})

afterEach(() => {
    jest.useRealTimers()
    queryClient.clear()
    document.body.innerHTML = ''
})

describe('usePullToRefresh', () => {
    it('mounts an arrow indicator and removes it on unmount', () => {
        const { unmount } = renderHook(() => usePullToRefresh(), { wrapper })

        expect(indicator()).not.toBeNull()
        expect(iconHtml()).toContain('M12 5v14')

        unmount()
        expect(indicator()).toBeNull()
    })

    it('taps once when the pull crosses the release threshold', () => {
        renderHook(() => usePullToRefresh(), { wrapper })

        touch('touchstart', 0)
        touch('touchmove', 100) // 50px of pull — below the 80px threshold
        expect(impactHaptic).not.toHaveBeenCalled()

        touch('touchmove', 200) // 100px of pull — armed
        touch('touchmove', 220) // still armed: no second tap
        expect(impactHaptic).toHaveBeenCalledTimes(1)
    })

    it('runs spinner → checkmark → success haptic after the refetch lands', async () => {
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
        renderHook(() => usePullToRefresh(), { wrapper })

        pullPastThreshold()
        touch('touchend', 200)

        expect(invalidateQueries).toHaveBeenCalled()
        expect(iconHtml()).toContain('stroke-dasharray="24 33"') // spinner arc

        // the spinner is held for a minimum duration so a warm-cache refetch
        // doesn't flash by unnoticed
        await act(async () => {}) // let the invalidation promise chain settle
        act(() => {
            jest.advanceTimersByTime(600)
        })

        expect(iconHtml()).toContain('M5 13l4 4L19 7') // checkmark
        expect(indicator()?.style.background).toBe('rgb(152, 233, 171)')
        expect(notifyHaptic).toHaveBeenCalledWith('success')

        // the refreshed content fades back in — the "it reloaded" signal on a
        // screen that never blinks
        const content = document.querySelector('#scrollable-content')
        expect(animateCalls.some((call) => call.element === content)).toBe(true)

        // ...then the indicator retracts and resets to the arrow
        act(() => {
            jest.advanceTimersByTime(550 + 220)
        })
        expect(iconHtml()).toContain('M12 5v14')
        expect(indicator()?.style.background).toBe('rgb(255, 255, 255)')
    })

    it('reloads the page instead of invalidating on web', () => {
        ;(isCapacitor as jest.Mock).mockReturnValue(false)
        const reload = jest.fn()
        Object.defineProperty(window, 'location', {
            value: { ...window.location, reload },
            writable: true,
        })
        renderHook(() => usePullToRefresh(), { wrapper })

        pullPastThreshold()
        touch('touchend', 200)

        expect(reload).toHaveBeenCalled()
    })

    it('ignores horizontal gestures so carousels keep working', () => {
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh(), { wrapper })

        const start = new Event('touchstart', { bubbles: true })
        Object.defineProperty(start, 'touches', { value: [{ clientX: 0, clientY: 0 }] })
        act(() => document.dispatchEvent(start))

        const move = new Event('touchmove', { bubbles: true })
        Object.defineProperty(move, 'touches', { value: [{ clientX: 200, clientY: 30 }] })
        act(() => document.dispatchEvent(move))

        touch('touchend', 30)

        expect(invalidateQueries).not.toHaveBeenCalled()
        expect(impactHaptic).not.toHaveBeenCalled()
    })
})
