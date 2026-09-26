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
import { usePullToRefresh, useShouldPullToRefresh } from '../usePullToRefresh'

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

// jsdom's CSSOM drops var() values outright, so the token backgrounds the hook
// assigns would read back as ''. store the raw assignment to keep it assertable.
const rawBackground = new WeakMap<CSSStyleDeclaration, string>()
beforeAll(() => {
    Object.defineProperty(CSSStyleDeclaration.prototype, 'background', {
        configurable: true,
        set(value: string) {
            rawBackground.set(this, value)
        },
        get() {
            return rawBackground.get(this) ?? ''
        },
    })
})

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
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
    // The layout's scroll container must stay visually stable during refresh.
    const content = document.createElement('div')
    content.id = 'scrollable-content'
    document.body.appendChild(content)
    window.scrollY = 0
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
        expect(indicator()?.style.background).toBe('var(--color-background-badge-success)')
        expect(notifyHaptic).toHaveBeenCalledWith('success')

        // Completion feedback belongs to the indicator: fading the entire
        // page makes a successful refresh look like a WebView flash.
        const content = document.querySelector('#scrollable-content')
        expect(animateCalls.some((call) => call.element === content)).toBe(false)

        // ...then the indicator retracts and resets to the arrow
        act(() => {
            jest.advanceTimersByTime(550 + 220)
        })
        expect(iconHtml()).toContain('M12 5v14')
        expect(indicator()?.style.background).toBe('var(--color-background-default)')
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

    it('does not turn an upward scroll followed by a reversal into a refresh', () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh(), { wrapper })

        touch('touchstart', 100)
        touch('touchmove', 50)
        touch('touchmove', 300)
        touch('touchend', 300)

        expect(indicator()?.style.opacity).toBe('0')
        expect(invalidate).not.toHaveBeenCalled()
        expect(impactHaptic).not.toHaveBeenCalled()
    })

    it.each(['move', 'release'])('cancels a pull when the app scrolls before the next %s', (phase) => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh({ shouldPullToRefresh: useShouldPullToRefresh() }), { wrapper })

        pullPastThreshold()
        document.querySelector('#scrollable-content')!.scrollTop = 30
        if (phase === 'move') {
            touch('touchmove', 220)
            // Once canceled, reaching the top again must not re-arm this gesture.
            document.querySelector('#scrollable-content')!.scrollTop = 0
        }
        touch('touchend', 220)

        expect(indicator()?.style.opacity).toBe('0')
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('ignores touches that start on an open vaul drawer', () => {
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh(), { wrapper })

        const sheet = document.createElement('div')
        sheet.setAttribute('data-vaul-drawer', '')
        const inner = document.createElement('button')
        sheet.appendChild(inner)
        document.body.appendChild(sheet)

        const start = new Event('touchstart', { bubbles: true })
        Object.defineProperty(start, 'touches', { value: [{ clientX: 0, clientY: 0 }] })
        act(() => {
            inner.dispatchEvent(start)
        })

        // a full downward drag on the sheet must not move the indicator
        touch('touchmove', 200)
        touch('touchend', 200)

        expect(indicator()?.style.opacity).toBe('0')
        expect(invalidateQueries).not.toHaveBeenCalled()
        expect(impactHaptic).not.toHaveBeenCalled()
        sheet.remove()
    })
})

describe('useShouldPullToRefresh', () => {
    it('requires both the document and the app content to be at the top', () => {
        const { result } = renderHook(() => useShouldPullToRefresh())
        expect(result.current()).toBe(true)

        window.scrollY = 30
        expect(result.current()).toBe(false)
        window.scrollY = 0
        document.querySelector('#scrollable-content')!.scrollTop = 30
        expect(result.current()).toBe(false)
    })

    it('checks the current scroll container after the layout remounts', () => {
        const { result } = renderHook(() => useShouldPullToRefresh())
        expect(result.current()).toBe(true)

        document.querySelector('#scrollable-content')!.remove()
        const replacement = document.createElement('div')
        replacement.id = 'scrollable-content'
        replacement.scrollTop = 30
        document.body.appendChild(replacement)

        expect(result.current()).toBe(false)
        replacement.scrollTop = 0
        expect(result.current()).toBe(true)
    })
})

describe('overlay gesture isolation', () => {
    const openDialog = () => {
        const dialog = document.createElement('div')
        dialog.setAttribute('role', 'dialog')
        dialog.setAttribute('data-state', 'open')
        document.body.appendChild(dialog)
        return dialog
    }

    it('ignores pulls while a drawer is open and resumes after it closes', () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
        renderHook(() => usePullToRefresh(), { wrapper })
        const dialog = openDialog()
        pullPastThreshold()
        touch('touchend', 200)
        expect(indicator()?.style.opacity).toBe('0')
        expect(impactHaptic).not.toHaveBeenCalled()
        expect(invalidate).not.toHaveBeenCalled()
        dialog.remove()
        pullPastThreshold()
        touch('touchend', 200)
        expect(invalidate).toHaveBeenCalledTimes(1)
    })

    it('cancels a pending refresh when a drawer opens before release', () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh(), { wrapper })
        pullPastThreshold()
        openDialog()
        touch('touchend', 200)
        expect(invalidate).not.toHaveBeenCalled()
        expect(indicator()?.style.opacity).toBe('0')
    })

    it('never refreshes a gesture cancelled by the browser', () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        renderHook(() => usePullToRefresh(), { wrapper })
        pullPastThreshold()
        touch('touchcancel', 200)
        expect(invalidate).not.toHaveBeenCalled()
    })
})

it('allows refresh with the closed always-mounted support dialog', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    renderHook(() => usePullToRefresh(), { wrapper })
    const support = document.createElement('div')
    support.setAttribute('role', 'dialog')
    support.setAttribute('aria-modal', 'false')
    document.body.appendChild(support)
    pullPastThreshold()
    touch('touchend', 200)
    expect(invalidate).toHaveBeenCalledTimes(1)
})
