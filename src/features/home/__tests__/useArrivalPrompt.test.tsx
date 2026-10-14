import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'

let mockUserId: string | undefined = 'u1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
let mockGeo = { countryCode: null as string | null, isLoading: false }
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: () => mockGeo }))
const mockFetchEdgeCountry = jest.fn<Promise<string | null>, []>()
jest.mock('@/features/setup/country-signals', () => ({ fetchEdgeCountry: () => mockFetchEdgeCountry() }))
const mockReportArrival = jest.fn<Promise<string | null>, [string]>()
jest.mock('@/services/arrival', () => ({ reportArrival: (country: string) => mockReportArrival(country) }))
let mockNative = false
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
let mockAppStateChange: ((state: { isActive: boolean }) => void) | undefined
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: (_event: string, handler: (state: { isActive: boolean }) => void) => {
            mockAppStateChange = handler
            return Promise.resolve({ remove: jest.fn() })
        },
    },
}))

import { useArrivalPrompt } from '../useArrivalPrompt'
import { resetArrivalSessionForTests } from '../arrival-session'

const HOUR = 60 * 60 * 1000
const flush = () => act(async () => {})

beforeEach(() => {
    jest.clearAllMocks()
    resetArrivalSessionForTests()
    mockUserId = 'u1'
    mockGeo = { countryCode: null, isLoading: false }
    mockNative = false
    mockAppStateChange = undefined
    mockFetchEdgeCountry.mockResolvedValue('AR')
    mockReportArrival.mockResolvedValue('qr_ar')
})

afterEach(() => jest.restoreAllMocks())

it('calls the API once per app session, across strict mode and Home remounts', async () => {
    const first = renderHook(() => useArrivalPrompt(), { wrapper: React.StrictMode })
    await waitFor(() => expect(first.result.current.arrival).toEqual({ userId: 'u1', country: 'AR', prompt: 'qr_ar' }))
    first.unmount()

    const second = renderHook(() => useArrivalPrompt())
    await flush()
    expect(second.result.current.arrival?.prompt).toBe('qr_ar')
    expect(mockReportArrival).toHaveBeenCalledTimes(1)
    expect(mockReportArrival).toHaveBeenCalledWith('AR')
})

it('uses the ipapi country only when the edge has none', async () => {
    mockFetchEdgeCountry.mockResolvedValue(null)
    mockGeo = { countryCode: 'br', isLoading: false }
    renderHook(() => useArrivalPrompt())
    await flush()
    expect(mockReportArrival).toHaveBeenCalledWith('BR')
})

it('waits for the ipapi lookup to settle before checking', async () => {
    mockGeo = { countryCode: null, isLoading: true }
    renderHook(() => useArrivalPrompt())
    await flush()
    expect(mockFetchEdgeCountry).not.toHaveBeenCalled()
})

it.each([null, 'Undefined', 'XX'])('makes no call without a country (ipapi answered %p)', async (ipCountry) => {
    mockFetchEdgeCountry.mockResolvedValue(null)
    mockGeo = { countryCode: ipCountry, isLoading: false }
    const { result } = renderHook(() => useArrivalPrompt())
    await flush()
    expect(mockReportArrival).not.toHaveBeenCalled()
    expect(result.current.arrival).toBeNull()
})

it('shows nothing when the backend answers no prompt, or fails', async () => {
    mockReportArrival.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useArrivalPrompt())
    await flush()
    expect(result.current.arrival).toBeNull()

    resetArrivalSessionForTests()
    mockReportArrival.mockRejectedValueOnce(new Error('offline'))
    const retry = renderHook(() => useArrivalPrompt())
    await flush()
    expect(retry.result.current.arrival).toBeNull()
})

it('reports the check as finished once it answered, with or without a prompt', async () => {
    mockReportArrival.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useArrivalPrompt())
    expect(result.current.checked).toBe(false)
    await flush()
    expect(result.current.checked).toBe(true)
    expect(result.current.arrival).toBeNull()
})

it('dismiss clears the prompt for the rest of the session', async () => {
    const { result } = renderHook(() => useArrivalPrompt())
    await waitFor(() => expect(result.current.arrival).not.toBeNull())
    act(() => result.current.dismiss())
    expect(result.current.arrival).toBeNull()
})

it('checks again after a native resume from 1 h in the background, not after a shorter one', async () => {
    mockNative = true
    let now = Date.parse('2026-10-14T12:00:00Z')
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    renderHook(() => useArrivalPrompt())
    await flush()
    expect(mockReportArrival).toHaveBeenCalledTimes(1)

    act(() => mockAppStateChange!({ isActive: false }))
    now += HOUR - 1
    act(() => mockAppStateChange!({ isActive: true }))
    await flush()
    expect(mockReportArrival).toHaveBeenCalledTimes(1)

    act(() => mockAppStateChange!({ isActive: false }))
    now += HOUR
    act(() => mockAppStateChange!({ isActive: true }))
    await flush()
    expect(mockReportArrival).toHaveBeenCalledTimes(2)
})

it('drops an answer that lands after another account signed in, and settles for the new one', async () => {
    let answerForU1!: (prompt: string | null) => void
    mockReportArrival.mockImplementationOnce(() => new Promise((resolve) => (answerForU1 = resolve)))
    mockReportArrival.mockResolvedValueOnce(null)
    const { result, rerender } = renderHook(() => useArrivalPrompt())
    await flush()

    mockUserId = 'u2'
    rerender()
    await flush()
    expect(result.current.checked).toBe(true)

    await act(async () => answerForU1('qr_ar'))
    expect(result.current.arrival).toBeNull()
    expect(result.current.checked).toBe(true)
})

it('a resume while the check runs starts no second request, and keeps its answer', async () => {
    mockNative = true
    let now = Date.parse('2026-10-14T12:00:00Z')
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    let answer!: (prompt: string | null) => void
    mockReportArrival.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    const { result } = renderHook(() => useArrivalPrompt())
    await flush()

    act(() => mockAppStateChange!({ isActive: false }))
    now += HOUR
    act(() => mockAppStateChange!({ isActive: true }))
    await flush()
    expect(mockReportArrival).toHaveBeenCalledTimes(1)

    await act(async () => answer('qr_ar'))
    expect(result.current.arrival?.prompt).toBe('qr_ar')
    expect(mockReportArrival).toHaveBeenCalledTimes(1)
})

it("checks for the next account that signs in, and never shows it the last account's prompt", async () => {
    const { result, rerender } = renderHook(() => useArrivalPrompt())
    await waitFor(() => expect(result.current.arrival).not.toBeNull())
    mockReportArrival.mockResolvedValueOnce(null)
    mockUserId = 'u2'
    rerender()
    expect(result.current.arrival).toBeNull()
    await flush()
    expect(mockReportArrival).toHaveBeenCalledTimes(2)
})
