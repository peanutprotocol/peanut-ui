import { act, renderHook, waitFor } from '@testing-library/react'
import { useStoreCountry } from '../useStoreCountry'
import { getStoreCountry, type StoreCountry } from '@/utils/store-country'

const remove = jest.fn().mockResolvedValue(undefined)
const addListener = jest.fn().mockResolvedValue({ remove })
jest.mock('@capacitor/app', () => ({ App: { addListener: (...args: unknown[]) => addListener(...args) } }))
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => true }))
jest.mock('@/utils/store-country', () => ({ getStoreCountry: jest.fn() }))
const read = jest.mocked(getStoreCountry)
const us: StoreCountry = { countryCode: 'US', source: 'app-store' }
const br: StoreCountry = { countryCode: 'BR', source: 'google-play' }

beforeEach(() => {
    jest.clearAllMocks()
    read.mockReset().mockResolvedValue(us)
    addListener.mockResolvedValue({ remove })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

async function nativeState(active: boolean) {
    await waitFor(() => expect(addListener).toHaveBeenCalled())
    await act(async () => addListener.mock.calls[0][1]({ isActive: active }))
}

it('reads on mount and refreshes instead of retaining the previous value', async () => {
    const { result } = renderHook(() => useStoreCountry())
    expect(result.current.country).toBeNull()
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.country).toEqual(us))
    let complete!: (value: StoreCountry | null) => void
    read.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = resolve
            })
    )
    let refresh!: Promise<StoreCountry | null>
    act(() => {
        refresh = result.current.refresh()
    })
    expect(result.current.country).toBeNull()
    expect(result.current.isLoading).toBe(true)
    await act(async () => {
        complete(br)
        await refresh
    })
    expect(result.current.country).toEqual(br)
    expect(result.current.isLoading).toBe(false)
})

it('clears on native background and reads the changed country on foreground', async () => {
    const { result } = renderHook(() => useStoreCountry())
    await waitFor(() => expect(result.current.country).toEqual(us))
    await nativeState(false)
    expect(result.current.country).toBeNull()
    read.mockResolvedValueOnce(br)
    await nativeState(true)
    await waitFor(() => expect(result.current.country).toEqual(br))
})

it('does not restore an in-flight result after the app backgrounds', async () => {
    let complete!: (value: StoreCountry) => void
    read.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = resolve
            })
    )
    const { result } = renderHook(() => useStoreCountry())
    await nativeState(false)
    await act(async () => complete(us))
    expect(result.current.country).toBeNull()
    expect(result.current.isLoading).toBe(false)
})

it('ignores an older read completing after a newer refresh', async () => {
    let complete!: (value: StoreCountry) => void
    read.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = resolve
            })
    )
    const { result } = renderHook(() => useStoreCountry())
    read.mockResolvedValueOnce(br)
    await act(async () => {
        await result.current.refresh()
    })
    await act(async () => complete(us))
    expect(result.current.country).toEqual(br)
})

it('finishes loading with unknown when the store cannot answer', async () => {
    read.mockResolvedValue(null)
    const { result } = renderHook(() => useStoreCountry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.country).toBeNull()
})

it('clears on document hide and reads fresh on visibility restoration', async () => {
    const { result } = renderHook(() => useStoreCountry())
    await waitFor(() => expect(result.current.country).toEqual(us))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.country).toBeNull()
    read.mockResolvedValueOnce(br)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.country).toEqual(br)
})

it('removes a lifecycle listener that registers after unmount', async () => {
    let complete!: (value: { remove: typeof remove }) => void
    addListener.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = resolve
            })
    )
    const { result, unmount } = renderHook(() => useStoreCountry())
    await waitFor(() => expect(addListener).toHaveBeenCalled())
    const refresh = result.current.refresh
    unmount()
    await act(async () => complete({ remove }))
    expect(remove).toHaveBeenCalledTimes(1)
    const count = read.mock.calls.length
    await expect(refresh()).resolves.toBeNull()
    expect(read).toHaveBeenCalledTimes(count)
})
