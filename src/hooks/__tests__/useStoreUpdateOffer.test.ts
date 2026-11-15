jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'
import { useStoreUpdateOffer } from '../useStoreUpdateOffer'
import type { StoreUpdateOffer } from '@/utils/store-update'

const offer: StoreUpdateOffer = { platform: 'android', installedVersion: '1', availableVersion: '2' }
const mockCheck = jest.fn<Promise<StoreUpdateOffer | null>, []>()
const mockInactive = { foreground: null }
let mockPolicy: { foreground: number | null; cutoffs?: { android?: string } }
const mockListeners = new Set<() => void>()

jest.mock('@/utils/store-update', () => ({ getStoreUpdateOffer: () => mockCheck() }))
jest.mock('@/features/kill-switches/kill-switches-store', () => ({
    getNativeStoreUpdatePolicy: () => mockPolicy,
    getServerNativeStoreUpdatePolicy: () => mockInactive,
    subscribeKillSwitches: (listener: () => void) => {
        mockListeners.add(listener)
        return () => mockListeners.delete(listener)
    },
}))

function setPolicy(policy: typeof mockPolicy) {
    act(() => {
        mockPolicy = policy
        mockListeners.forEach((listener) => listener())
    })
}

beforeEach(() => {
    mockPolicy = { foreground: 1, cutoffs: { android: '2' } }
    mockCheck.mockReset().mockResolvedValue(null)
})

it('only exposes a store offer after the current foreground check settles', async () => {
    mockCheck.mockResolvedValue(offer)
    const { result } = renderHook(() => useStoreUpdateOffer())
    expect(result.current.offer).toBeNull()
    await waitFor(() => expect(result.current.offer).toEqual(offer))
})

it('shares a lookup between concurrent subscribers', async () => {
    let finish!: (value: StoreUpdateOffer | null) => void
    mockCheck.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const first = renderHook(() => useStoreUpdateOffer())
    const second = renderHook(() => useStoreUpdateOffer())
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1))
    await act(async () => finish(offer))
    expect(first.result.current.offer).toEqual(offer)
    expect(second.result.current.offer).toEqual(offer)
    expect(mockCheck).toHaveBeenCalledTimes(1)
})

it('does no store work without an active native foreground', async () => {
    mockPolicy = mockInactive
    const { result } = renderHook(() => useStoreUpdateOffer())
    await act(async () => {})
    expect(result.current.offer).toBeNull()
    expect(mockCheck).not.toHaveBeenCalled()
})

it('retains the confirmed fact when policy is unavailable or changes within the foreground', async () => {
    mockPolicy = { foreground: 1 }
    mockCheck.mockResolvedValue(offer)
    const { result } = renderHook(() => useStoreUpdateOffer())
    await waitFor(() => expect(result.current).toEqual({ offer, cutoffs: undefined }))
    setPolicy({ foreground: 1, cutoffs: {} })
    expect(result.current).toEqual({ offer, cutoffs: {} })
    expect(mockCheck).toHaveBeenCalledTimes(1)
})

it('withdraws a stale offer during background and while a resumed lookup is pending', async () => {
    mockCheck.mockResolvedValueOnce(offer)
    const { result } = renderHook(() => useStoreUpdateOffer())
    await waitFor(() => expect(result.current.offer).toEqual(offer))
    let finish!: (value: StoreUpdateOffer | null) => void
    mockCheck.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    setPolicy(mockInactive)
    expect(result.current.offer).toBeNull()
    setPolicy({ foreground: 2, cutoffs: { android: '3' } })
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(2))
    expect(result.current.offer).toBeNull()
    await act(async () => finish(null))
    expect(result.current.offer).toBeNull()
})

it('discards an old answer and coalesces resumes while its request is in flight', async () => {
    let finishOld!: (value: StoreUpdateOffer | null) => void
    mockCheck.mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)))
    const { result } = renderHook(() => useStoreUpdateOffer())
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1))
    setPolicy(mockInactive)
    setPolicy({ foreground: 2 })
    setPolicy(mockInactive)
    setPolicy({ foreground: 3 })
    await act(async () => {})
    expect(mockCheck).toHaveBeenCalledTimes(1)
    await act(async () => finishOld(offer))
    expect(mockCheck).toHaveBeenCalledTimes(2)
    expect(result.current.offer).toBeNull()
})

it('retries a failed lookup on the next foreground', async () => {
    mockCheck.mockResolvedValueOnce(null).mockResolvedValueOnce(offer)
    const { result } = renderHook(() => useStoreUpdateOffer())
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1))
    expect(result.current.offer).toBeNull()
    setPolicy(mockInactive)
    setPolicy({ foreground: 2, cutoffs: {} })
    await waitFor(() => expect(result.current.offer).toEqual(offer))
    expect(mockCheck).toHaveBeenCalledTimes(2)
})
