/**
 * The IP lookup only sorts country lists. A lookup that never settles must still
 * end, as "unknown", so nothing that reads `isLoading` waits forever
 * (TASK-22967: ipapi.co answered a Cloudflare challenge and left the bank
 * country picker on skeleton rows).
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { GEO_LOOKUP_TIMEOUT_MS, useGeoLocation } from '../useGeoLocation'

// The hook keeps a module-level cache that only a successful lookup fills, so
// the timeout case runs first and the success case last.

const originalFetch = global.fetch

afterEach(() => {
    global.fetch = originalFetch
    sessionStorage.clear()
    jest.useRealTimers()
})

describe('useGeoLocation', () => {
    it('gives up after the timeout and answers unknown', async () => {
        jest.useFakeTimers()
        // a request that never answers until it is aborted
        const fetchMock = jest.fn(
            (_url: string, init?: RequestInit) =>
                new Promise<Response>((_, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
                })
        )
        global.fetch = fetchMock as unknown as typeof fetch

        const { result } = renderHook(() => useGeoLocation())
        expect(result.current.isLoading).toBe(true)
        expect(fetchMock.mock.calls[0][1]?.signal).toBeDefined()

        await act(async () => {
            jest.advanceTimersByTime(GEO_LOOKUP_TIMEOUT_MS)
        })

        expect(result.current.isLoading).toBe(false)
        expect(result.current.countryCode).toBeNull()
        expect(result.current.error).not.toBeNull()
    })

    it('still returns the country when the lookup answers in time', async () => {
        global.fetch = jest.fn(async () => ({ ok: true, text: async () => 'DE' })) as unknown as typeof fetch

        const { result } = renderHook(() => useGeoLocation())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.countryCode).toBe('DE')
        expect(result.current.error).toBeNull()
    })
})
