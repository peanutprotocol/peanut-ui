// tests for apiFetch and serverFetch routing between capacitor (direct backend) and web (proxy)

import { apiFetch, serverFetch } from '../api-fetch'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { isCapacitor } from '@/utils/capacitor'
import { getAuthHeaders } from '@/utils/auth-token'

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => false),
}))

jest.mock('@/utils/auth-token', () => ({
    getAuthHeaders: jest.fn((extra?: Record<string, string>) => ({
        Authorization: 'Bearer test-token',
        ...extra,
    })),
}))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>
const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

describe('apiFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('url routing', () => {
        it('should use backendPath with PEANUT_API_URL in capacitor mode', async () => {
            mockIsCapacitor.mockReturnValue(true)

            await apiFetch('/users/me', '/api/proxy/users/me')

            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/me', expect.any(Object))
        })

        it('should use proxyPath in web mode', async () => {
            mockIsCapacitor.mockReturnValue(false)

            await apiFetch('/users/me', '/api/proxy/users/me')

            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/users/me', expect.any(Object))
        })
    })

    describe('auth headers', () => {
        it('should add auth headers in capacitor mode', async () => {
            mockIsCapacitor.mockReturnValue(true)

            await apiFetch('/users/me', '/api/proxy/users/me')

            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })

        it('should add auth headers in web mode too (proxy forwards them)', async () => {
            // Updated 2026-04-24: apiFetch was changed to ALWAYS forward the
            // Authorization header (web + capacitor). Backend's verifyAuth
            // reads the header, not the cookie; the Next.js proxy relays
            // whatever headers the caller sets. See JSDoc on apiFetch.
            mockIsCapacitor.mockReturnValue(false)

            await apiFetch('/users/me', '/api/proxy/users/me')

            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })
    })

    describe('content-type header', () => {
        it('should add Content-Type when body is present', async () => {
            await apiFetch('/users/me', '/api/proxy/users/me', {
                method: 'POST',
                body: JSON.stringify({ name: 'test' }),
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('should not add Content-Type when no body', async () => {
            await apiFetch('/users/me', '/api/proxy/users/me', {
                method: 'GET',
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })
    })

    describe('request options passthrough', () => {
        it('should pass through method and body', async () => {
            const body = JSON.stringify({ key: 'value' })

            await apiFetch('/update', '/api/proxy/update', {
                method: 'POST',
                body,
            })

            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    body,
                })
            )
        })

        it('should pass through custom headers in web mode', async () => {
            await apiFetch('/data', '/api/proxy/data', {
                headers: { 'X-Custom': 'value' },
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['X-Custom']).toBe('value')
        })

        it('should pass through extra headers via getAuthHeaders in capacitor mode', async () => {
            mockIsCapacitor.mockReturnValue(true)

            await apiFetch('/data', '/api/proxy/data', {
                headers: { 'X-Custom': 'value' },
            })

            expect(getAuthHeaders).toHaveBeenCalledWith({ 'X-Custom': 'value' })
        })
    })
})

describe('serverFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
    })

    describe('web mode — proxy url routing by method', () => {
        it('should route GET to /api/proxy/get/', async () => {
            await serverFetch('/users/history', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/get/users/history', expect.any(Object))
        })

        it('should route HEAD to /api/proxy/get/', async () => {
            await serverFetch('/users/username/test', { method: 'HEAD' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/get/users/username/test', expect.any(Object))
        })

        it('should route POST to /api/proxy/', async () => {
            await serverFetch('/invites/validate', { method: 'POST', body: JSON.stringify({ code: 'x' }) })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/invites/validate', expect.any(Object))
        })

        it('should route PATCH to /api/proxy/patch/', async () => {
            await serverFetch('/send-links/key', { method: 'PATCH', body: JSON.stringify({}) })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/patch/send-links/key', expect.any(Object))
        })

        it('should route DELETE to /api/proxy/delete/', async () => {
            await serverFetch('/bridge/onramp/123/cancel', { method: 'DELETE' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                '/api/proxy/delete/bridge/onramp/123/cancel',
                expect.any(Object)
            )
        })

        it('should default to GET when no method specified', async () => {
            await serverFetch('/history/entry-1')
            expect(mockFetchWithSentry).toHaveBeenCalledWith('/api/proxy/get/history/entry-1', expect.any(Object))
        })

        it('should preserve query params', async () => {
            await serverFetch('/users/history?cursor=abc&limit=10', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                '/api/proxy/get/users/history?cursor=abc&limit=10',
                expect.any(Object)
            )
        })
    })

    describe('native mode — direct backend urls', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
        })

        it('should call PEANUT_API_URL directly for GET', async () => {
            await serverFetch('/users/history', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/history', expect.any(Object))
        })

        it('should call PEANUT_API_URL directly for POST', async () => {
            await serverFetch('/invites/validate', { method: 'POST', body: JSON.stringify({}) })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/invites/validate',
                expect.any(Object)
            )
        })

        it('should call PEANUT_API_URL directly for DELETE', async () => {
            await serverFetch('/bridge/onramp/123/cancel', { method: 'DELETE' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/bridge/onramp/123/cancel',
                expect.any(Object)
            )
        })
    })

    describe('auth headers', () => {
        it('should include auth headers via getAuthHeaders in native mode', async () => {
            mockIsCapacitor.mockReturnValue(true)
            await serverFetch('/users/me', { method: 'GET' })

            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })

        it('should forward auth headers on web for proxy relay', async () => {
            mockIsCapacitor.mockReturnValue(false)
            await serverFetch('/users/me', { method: 'GET' })

            // serverFetch calls getAuthHeaders() on web too, to forward to proxy
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })
    })

    describe('content-type header', () => {
        it('should auto-add Content-Type for POST with body', async () => {
            await serverFetch('/update', { method: 'POST', body: JSON.stringify({ x: 1 }) })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('should not add Content-Type for GET without body', async () => {
            await serverFetch('/data', { method: 'GET' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })

        it('should respect caller-provided Content-Type', async () => {
            await serverFetch('/upload', {
                method: 'POST',
                body: 'raw data',
                headers: { 'Content-Type': 'text/plain' },
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('text/plain')
        })
    })
})
