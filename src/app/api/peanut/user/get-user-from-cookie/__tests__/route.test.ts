/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// --- Mocks ---

const mockCookieGet = jest.fn()
const mockCookieSet = jest.fn()
jest.mock('next/headers', () => ({
    cookies: jest.fn(async () => ({
        get: mockCookieGet,
        set: mockCookieSet,
    })),
}))

// Mock getJWTCookie to use our mock cookie store
jest.mock('@/utils/cookie-migration.utils', () => ({
    getJWTCookie: jest.fn(async () => mockCookieGet('jwt-token')),
}))

const mockFetch = jest.fn()
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: (...args: unknown[]) => mockFetch(...args),
}))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test',
}))

// --- Tests ---

import { GET } from '../route'

function makeRequest() {
    return new NextRequest('http://localhost/api/peanut/user/get-user-from-cookie')
}

beforeEach(() => {
    jest.clearAllMocks()
    process.env.PEANUT_API_KEY = 'test-api-key'
})

describe('GET /api/peanut/user/get-user-from-cookie', () => {
    it('returns 400 when no JWT cookie exists', async () => {
        mockCookieGet.mockReturnValue(undefined)

        const res = await GET(makeRequest())

        expect(res.status).toBe(400)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns user data and refreshes cookie on successful auth (200)', async () => {
        mockCookieGet.mockReturnValue({ name: 'jwt-token', value: 'valid-token' })
        mockFetch.mockResolvedValue({
            status: 200,
            json: async () => ({ user: { userId: '123', email: 'test@test.com' } }),
        })

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.user.userId).toBe('123')

        // Cookie should be refreshed with 30-day maxAge
        expect(mockCookieSet).toHaveBeenCalledWith('jwt-token', 'valid-token', {
            httpOnly: false,
            secure: false, // NODE_ENV !== 'production' in tests
            path: '/',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60,
        })
    })

    it('clears cookie and sets Clear-Site-Data on 401 (expired JWT)', async () => {
        mockCookieGet.mockReturnValue({ name: 'jwt-token', value: 'expired-token' })
        mockFetch.mockResolvedValue({
            status: 401,
        })

        const res = await GET(makeRequest())

        expect(res.status).toBe(401)

        // Cookie should be cleared
        expect(res.headers.get('Set-Cookie')).toBe('jwt-token=; Path=/; Max-Age=0; SameSite=Lax')
        expect(res.headers.get('Clear-Site-Data')).toBe('"cache"')

        // Cookie should NOT be refreshed
        expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('does NOT refresh cookie on non-200 responses', async () => {
        mockCookieGet.mockReturnValue({ name: 'jwt-token', value: 'some-token' })
        mockFetch.mockResolvedValue({
            status: 500,
        })

        const res = await GET(makeRequest())

        expect(res.status).toBe(500)
        expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('still returns 200 if cookie refresh fails', async () => {
        mockCookieGet.mockReturnValue({ name: 'jwt-token', value: 'valid-token' })
        mockFetch.mockResolvedValue({
            status: 200,
            json: async () => ({ user: { userId: '123' } }),
        })
        mockCookieSet.mockImplementation(() => {
            throw new Error('cookies() can only be used in server components')
        })

        const res = await GET(makeRequest())

        // Should still succeed — cookie refresh is best-effort
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.user.userId).toBe('123')
    })
})
