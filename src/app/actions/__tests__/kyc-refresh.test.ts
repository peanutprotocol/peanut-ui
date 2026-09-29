/**
 * Wire-level tests for refreshKycState (POST /users/kyc/refresh): the result
 * is read from the response body, and every failure reads as "not expedited"
 * so the caller falls back to plain refetching (TASK-22818).
 */
import { refreshKycState } from '@/app/actions/sumsub'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const respondWith = (status: number, body: unknown) => {
    mockFetch.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response)
}

beforeEach(() => mockFetch.mockReset())

describe('refreshKycState', () => {
    it('posts without a body and reads the expedite answer', async () => {
        respondWith(200, { expedited: true })
        await expect(refreshKycState()).resolves.toEqual({ expedited: true })
        expect(mockFetch).toHaveBeenCalledWith('/users/kyc/refresh', { method: 'POST' })
        respondWith(200, { expedited: false })
        await expect(refreshKycState()).resolves.toEqual({ expedited: false })
    })

    it('a route that is not there yet, or a rate-limit answer, reads as not expedited', async () => {
        respondWith(404, { error: 'Not Found' })
        await expect(refreshKycState()).resolves.toEqual({ expedited: false })
        respondWith(429, { statusCode: 429, error: 'Too Many Requests' })
        await expect(refreshKycState()).resolves.toEqual({ expedited: false })
    })

    it('a transport failure reads as not expedited, never throws', async () => {
        mockFetch.mockRejectedValue(new Error('network down'))
        await expect(refreshKycState()).resolves.toEqual({ expedited: false })
    })
})
