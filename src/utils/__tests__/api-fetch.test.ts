// tests for apiFetch and serverFetch — both now call PEANUT_API_URL directly
// on every platform. The historical web→proxy fork is gone (the proxy was
// retired once peanut-api-ts/dev dropped the api-key requirement and CORS
// already allows *.peanut.me + capacitor://).

import { apiFetch, serverFetch } from '../api-fetch'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getAuthHeaders } from '@/utils/auth-token'

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}))

jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(() => Promise.resolve()),
    getAuthHeaders: jest.fn((extra?: Record<string, string>) => ({
        Authorization: 'Bearer test-token',
        ...extra,
    })),
}))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

describe('apiFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('url', () => {
        it('routes path to PEANUT_API_URL', async () => {
            await apiFetch('/users/me')
            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/me', expect.any(Object))
        })

        it('preserves query params', async () => {
            await apiFetch('/users/history?cursor=abc&limit=10')
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/users/history?cursor=abc&limit=10',
                expect.any(Object)
            )
        })
    })

    describe('auth headers', () => {
        it('attaches Authorization via getAuthHeaders', async () => {
            await apiFetch('/users/me')
            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })

        it('forwards caller-provided headers through getAuthHeaders', async () => {
            await apiFetch('/users/me', { headers: { 'X-Custom': 'value' } })
            expect(getAuthHeaders).toHaveBeenCalledWith({ 'X-Custom': 'value' })
        })
    })

    describe('content-type header', () => {
        it('adds Content-Type when body is present', async () => {
            await apiFetch('/users/me', {
                method: 'POST',
                body: JSON.stringify({ name: 'test' }),
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('does not add Content-Type when no body', async () => {
            await apiFetch('/users/me', { method: 'GET' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })
    })

    describe('request options passthrough', () => {
        it('passes through method and body', async () => {
            const body = JSON.stringify({ key: 'value' })

            await apiFetch('/update', {
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
    })
})

describe('serverFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('url', () => {
        it('routes GET to PEANUT_API_URL', async () => {
            await serverFetch('/users/history', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith('https://api.test.com/users/history', expect.any(Object))
        })

        it('routes POST to PEANUT_API_URL', async () => {
            await serverFetch('/invites/validate', { method: 'POST', body: JSON.stringify({}) })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/invites/validate',
                expect.any(Object)
            )
        })

        it('routes DELETE to PEANUT_API_URL', async () => {
            await serverFetch('/bridge/onramp/123/cancel', { method: 'DELETE' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/bridge/onramp/123/cancel',
                expect.any(Object)
            )
        })

        it('preserves query params', async () => {
            await serverFetch('/users/history?cursor=abc&limit=10', { method: 'GET' })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(
                'https://api.test.com/users/history?cursor=abc&limit=10',
                expect.any(Object)
            )
        })
    })

    describe('auth headers', () => {
        it('attaches Authorization via getAuthHeaders', async () => {
            await serverFetch('/users/me', { method: 'GET' })
            expect(getAuthHeaders).toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
        })
    })

    describe('content-type header', () => {
        it('auto-adds Content-Type for POST with body', async () => {
            await serverFetch('/update', { method: 'POST', body: JSON.stringify({ x: 1 }) })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        })

        it('does not add Content-Type for GET without body', async () => {
            await serverFetch('/data', { method: 'GET' })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
        })

        it('respects caller-provided Content-Type', async () => {
            await serverFetch('/upload', {
                method: 'POST',
                body: 'raw data',
                headers: { 'Content-Type': 'text/plain' },
            })

            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Content-Type']).toBe('text/plain')
        })
    })

    describe('timeoutMs', () => {
        it('forwards timeoutMs to fetchWithSentry', async () => {
            await serverFetch('/long-running', { method: 'POST', body: '{}', timeoutMs: 60_000 })
            expect(mockFetchWithSentry).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 60_000)
        })

        it('omits the third arg when timeoutMs is not set', async () => {
            await serverFetch('/quick', { method: 'GET' })
            const callArgs = mockFetchWithSentry.mock.calls[0]
            expect(callArgs.length).toBe(2)
        })
    })
})
