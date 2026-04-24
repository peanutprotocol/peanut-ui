// tests for apiFetch routing between capacitor (direct backend) and web (proxy)

import { apiFetch } from '../api-fetch'
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

        it('should not add auth headers in web mode', async () => {
            mockIsCapacitor.mockReturnValue(false)

            await apiFetch('/users/me', '/api/proxy/users/me')

            expect(getAuthHeaders).not.toHaveBeenCalled()
            const callArgs = mockFetchWithSentry.mock.calls[0][1]
            expect((callArgs?.headers as Record<string, string>)['Authorization']).toBeUndefined()
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
