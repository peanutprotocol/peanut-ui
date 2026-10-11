import { act, renderHook, waitFor } from '@testing-library/react'
import { useStoreUpdateAvailable } from '../useStoreUpdateAvailable'

const mockCheck = jest.fn()
const mockRemove = jest.fn().mockResolvedValue(undefined)
const mockAddListener = jest.fn()
let mockForeground: ((state: { isActive: boolean }) => void) | undefined
let mockNative = true
jest.mock('@/utils/store-update', () => ({ isStoreUpdateAvailable: () => mockCheck() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@capacitor/app', () => ({ App: { addListener: (...args: unknown[]) => mockAddListener(...args) } }))

beforeEach(() => {
    mockNative = true
    mockForeground = undefined
    mockCheck.mockReset().mockResolvedValue(false)
    mockRemove.mockClear()
    mockAddListener.mockReset().mockImplementation(async (_event, callback) => {
        mockForeground = callback
        return { remove: mockRemove }
    })
})

it('shows the store offer only after a positive availability check', async () => {
    mockCheck.mockResolvedValue(true)
    const { result } = renderHook(() => useStoreUpdateAvailable(true))
    expect(result.current).toBe(false)
    await waitFor(() => expect(result.current).toBe(true))
})

it('hides an unavailable update even when a native compatibility update is needed', async () => {
    const { result } = renderHook(() => useStoreUpdateAvailable(true))
    await act(async () => {})
    expect(mockCheck).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(false)
})

it.each([false, true])('does no store work on web with compatibility debt %s', async (required) => {
    mockNative = false
    const { result } = renderHook(() => useStoreUpdateAvailable(required))
    await act(async () => {})
    expect(result.current).toBe(false)
    expect(mockCheck).not.toHaveBeenCalled()
    expect(mockAddListener).not.toHaveBeenCalled()
})

it('waits for compatibility debt and hides the offer when it is cleared', async () => {
    mockCheck.mockResolvedValue(true)
    const { result, rerender } = renderHook(({ required }) => useStoreUpdateAvailable(required), {
        initialProps: { required: false },
    })
    expect(result.current).toBe(false)
    expect(mockCheck).not.toHaveBeenCalled()
    rerender({ required: true })
    await waitFor(() => expect(result.current).toBe(true))
    rerender({ required: false })
    expect(result.current).toBe(false)
    expect(mockRemove).toHaveBeenCalledTimes(1)
})

it('rechecks on native foreground and withdraws a stale offer while the new check is pending', async () => {
    mockCheck.mockResolvedValueOnce(true)
    const { result } = renderHook(() => useStoreUpdateAvailable(true))
    await waitFor(() => expect(result.current).toBe(true))
    await waitFor(() => expect(mockForeground).toBeDefined())
    let finish!: (available: boolean) => void
    mockCheck.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)))
    act(() => mockForeground?.({ isActive: false }))
    expect(mockCheck).toHaveBeenCalledTimes(1)
    act(() => mockForeground?.({ isActive: true }))
    expect(result.current).toBe(false)
    await act(async () => finish(false))
    expect(result.current).toBe(false)
})

it('ignores an older positive response arriving after a newer foreground check', async () => {
    let finishOld!: (available: boolean) => void
    mockCheck.mockImplementationOnce(() => new Promise<boolean>((resolve) => (finishOld = resolve)))
    const { result } = renderHook(() => useStoreUpdateAvailable(true))
    await waitFor(() => expect(mockForeground).toBeDefined())
    await act(async () => mockForeground?.({ isActive: true }))
    expect(result.current).toBe(false)
    await act(async () => finishOld(true))
    expect(result.current).toBe(false)
})

it('removes a lifecycle listener that finishes registering after unmount', async () => {
    let finish!: (listener: { remove: typeof mockRemove }) => void
    mockAddListener.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const { unmount } = renderHook(() => useStoreUpdateAvailable(true))
    await waitFor(() => expect(mockAddListener).toHaveBeenCalled())
    unmount()
    await act(async () => finish({ remove: mockRemove }))
    expect(mockRemove).toHaveBeenCalledTimes(1)
})
