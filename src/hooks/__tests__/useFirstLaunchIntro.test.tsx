import { act, renderHook } from '@testing-library/react'
import { FIRST_LAUNCH_INTRO_KEY, useFirstLaunchIntro } from '../useFirstLaunchIntro'

import { markFirstLaunchIntroSeen } from '@/utils/first-launch-intro'

let mockNative = true
let mockSplashGone: Promise<void>
const mockGet = jest.fn()
const mockSet = jest.fn()
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => mockNative }))
jest.mock('@/hooks/useSplashGate', () => ({ whenNativeSplashHidden: () => mockSplashGone }))
jest.mock('@capacitor/preferences', () => ({
    Preferences: { get: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) },
}))
const flush = async () => {
    await act(async () => {
        for (let i = 0; i < 12; i++) await Promise.resolve()
    })
}
const advance = async (time: number) => {
    await act(async () => jest.advanceTimersByTime(time))
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    mockNative = true
    mockSplashGone = Promise.resolve()
    mockGet.mockResolvedValue({ value: null })
    mockSet.mockResolvedValue(undefined)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => jest.useRealTimers())

it('shows the delayed greeting, then advances after five visible seconds and persists once per install', async () => {
    const { result, unmount } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    expect(result.current.phase).toBe('intro')
    expect(mockSet).toHaveBeenCalledWith({ key: FIRST_LAUNCH_INTRO_KEY, value: '1' })
    act(() => result.current.onMascotReady())
    await advance(699)
    expect(result.current.greetingVisible).toBe(false)
    await advance(1)
    expect(result.current.greetingVisible).toBe(true)
    await advance(4299)
    expect(result.current.active).toBe(true)
    await advance(1)
    expect(result.current.active).toBe(false)
    unmount()
    const returning = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    expect(returning.result.current.active).toBe(false)
    expect(mockSet).toHaveBeenCalledTimes(1)
})

it('starts the countdown after the native splash actually hides and the artwork is ready', async () => {
    let hide!: () => void
    mockSplashGone = new Promise<void>((resolve) => (hide = resolve))
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    act(() => result.current.onMascotReady())
    await advance(6000)
    expect(result.current.active).toBe(true)
    expect(result.current.greetingVisible).toBe(false)
    await act(async () => hide())
    await advance(4999)
    expect(result.current.active).toBe(true)
    await advance(1)
    expect(result.current.active).toBe(false)
})

it('pauses the five-second countdown while the document is hidden', async () => {
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    act(() => result.current.onMascotReady())
    await advance(2000)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await advance(10000)
    expect(result.current.active).toBe(true)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await advance(2999)
    expect(result.current.active).toBe(true)
    await advance(1)
    expect(result.current.active).toBe(false)
})

it('reads the durable native flag when WebView storage has been evicted', async () => {
    mockGet.mockResolvedValue({ value: '1' })
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    expect(result.current.active).toBe(false)
    expect(mockSet).not.toHaveBeenCalled()
})

it.each([false, true])('does not run on the web or on a restored signup step (native=%s)', async (native) => {
    mockNative = native
    const { result } = renderHook(() => useFirstLaunchIntro(!native))
    await flush()
    expect(result.current.active).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
})

it('continues if preferences fail or the decorative animation never becomes ready', async () => {
    mockGet.mockRejectedValue(new Error('storage unavailable'))
    mockSet.mockRejectedValue(new Error('storage unavailable'))
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    await advance(1500)
    await advance(5000)
    expect(result.current.active).toBe(false)
})

it('does not block startup on a never-settling native preference read', async () => {
    mockGet.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    await advance(700)
    await flush()
    expect(result.current.phase).toBe('intro')
    act(() => result.current.onMascotReady())
    await advance(5000)
    expect(result.current.active).toBe(false)
})

it('cleans up the pending presentation when a deep link leaves landing', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useFirstLaunchIntro(enabled), {
        initialProps: { enabled: true },
    })
    await flush()
    act(() => result.current.onMascotReady())
    await advance(1000)
    rerender({ enabled: false })
    await advance(6000)
    expect(result.current.active).toBe(false)
})

it('can preview the real intro without changing install state', async () => {
    mockNative = false
    const { result } = renderHook(() => useFirstLaunchIntro(true, 'play'))
    await flush()
    act(() => result.current.onMascotReady())
    await advance(5000)
    expect(result.current.active).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
    expect(localStorage.getItem(FIRST_LAUNCH_INTRO_KEY)).toBeNull()
})

it('holds the isolated capture surface on the greeting without persisting any flag', async () => {
    mockNative = false
    const { result } = renderHook(() => useFirstLaunchIntro(true, 'still'))
    await flush()
    act(() => result.current.onMascotReady())
    await advance(10000)
    expect(result.current.active).toBe(true)
    expect(result.current.greetingVisible).toBe(true)
    expect(mockSet).not.toHaveBeenCalled()
})

it('opens landing immediately after logout even when this install never showed the intro', async () => {
    await act(async () => {
        await markFirstLaunchIntroSeen()
    })
    expect(mockSet).toHaveBeenCalledWith({ key: FIRST_LAUNCH_INTRO_KEY, value: '1' })
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    expect(result.current.phase).toBe('done')
    expect(result.current.active).toBe(false)
    expect(result.current.played).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
})

it('skips the checking frame when the intro was already seen', () => {
    localStorage.setItem(FIRST_LAUNCH_INTRO_KEY, '1')
    const { result } = renderHook(() => useFirstLaunchIntro(true))
    expect(result.current.active).toBe(false)
    expect(result.current.phase).toBe('done')
    expect(mockGet).not.toHaveBeenCalled()
})

it('restores the local flag from native storage for later landing mounts', async () => {
    mockGet.mockResolvedValue({ value: '1' })
    const first = renderHook(() => useFirstLaunchIntro(true))
    await flush()
    first.unmount()
    mockGet.mockClear()
    const returning = renderHook(() => useFirstLaunchIntro(true))
    expect(returning.result.current.active).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
})

it('keeps logout unblocked when the native preference write hangs', async () => {
    mockSet.mockImplementation(() => new Promise(() => {}))
    const finished = jest.fn()
    const marking = markFirstLaunchIntroSeen().then(finished)
    await flush()
    expect(localStorage.getItem(FIRST_LAUNCH_INTRO_KEY)).toBe('1')
    expect(finished).not.toHaveBeenCalled()
    await advance(700)
    await marking
    expect(finished).toHaveBeenCalledTimes(1)
})
