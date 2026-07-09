// tests for auth-token jwt management (web vs capacitor)

import Cookies from 'js-cookie'
import { isCapacitor } from '@/utils/capacitor'
import { CapacitorCookies } from '@capacitor/core'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

jest.mock('js-cookie', () => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
}))

jest.mock('@capacitor/core', () => ({
    CapacitorCookies: {
        getCookies: jest.fn(),
        clearCookies: jest.fn(),
    },
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
// Cookies.get has overloaded signatures (one-arg returns string|undefined, no-arg
// returns { [key: string]: string }). jest.Mocked<typeof Cookies> picks the no-arg
// overload for mockReturnValue, which blocks mocking string returns. Narrow it.
const mockCookies = Cookies as unknown as {
    get: jest.Mock<string | undefined, [name?: string]>
    set: jest.Mock
    remove: jest.Mock
}
const mockCapCookies = CapacitorCookies as unknown as {
    getCookies: jest.Mock
    clearCookies: jest.Mock
}

import { getAuthToken, setAuthToken, clearAuthToken, getAuthHeaders, hasNativeSessionCookie } from '../auth-token'

describe('auth-token', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        mockCapCookies.clearCookies.mockResolvedValue(undefined)
        mockCapCookies.getCookies.mockResolvedValue({})
        // reset document.cookie
        document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('getAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('is always null — the native cookie jar is the credential, not JS', () => {
                localStorage.setItem('jwt-token', 'stale-local-token')
                mockCookies.get.mockReturnValue('stale-cookie-token')
                expect(getAuthToken()).toBeNull()
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should read from cookies', () => {
                mockCookies.get.mockReturnValue('web-token-456')
                expect(getAuthToken()).toBe('web-token-456')
                expect(mockCookies.get).toHaveBeenCalledWith('jwt-token')
            })

            it('should return null when cookie is not set', () => {
                mockCookies.get.mockReturnValue(undefined)
                expect(getAuthToken()).toBeNull()
            })
        })
    })

    describe('setAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('is a no-op — the server Set-Cookie already updated the native jar', () => {
                setAuthToken('new-cap-token')
                expect(localStorage.getItem('jwt-token')).toBeNull()
                expect(mockCookies.set).not.toHaveBeenCalled()
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should save to cookie via js-cookie', () => {
                setAuthToken('new-web-token')
                expect(mockCookies.set).toHaveBeenCalledWith('jwt-token', 'new-web-token', {
                    expires: 30,
                    path: '/',
                })
            })

            it('should not save to localStorage', () => {
                setAuthToken('new-web-token')
                expect(localStorage.getItem('jwt-token')).toBeNull()
            })
        })
    })

    describe('hasNativeSessionCookie', () => {
        it('returns false on web without touching the native jar', async () => {
            mockIsCapacitor.mockReturnValue(false)
            await expect(hasNativeSessionCookie()).resolves.toBe(false)
            expect(mockCapCookies.getCookies).not.toHaveBeenCalled()
        })

        it('returns true when the jar holds a jwt-token cookie', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockCapCookies.getCookies.mockResolvedValue({ 'jwt-token': 'jar-token' })
            await expect(hasNativeSessionCookie()).resolves.toBe(true)
        })

        it('returns false when the jar has no jwt-token cookie', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockCapCookies.getCookies.mockResolvedValue({ other: 'cookie' })
            await expect(hasNativeSessionCookie()).resolves.toBe(false)
        })

        it('returns false when the native read fails', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockCapCookies.getCookies.mockRejectedValue(new Error('bridge down'))
            await expect(hasNativeSessionCookie()).resolves.toBe(false)
        })
    })

    describe('clearAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('should clear the native cookie jar (the actual credential)', async () => {
                await clearAuthToken()
                expect(mockCapCookies.clearCookies).toHaveBeenCalledWith({
                    url: expect.stringContaining('http'),
                })
            })

            it('should remove any localStorage remnant from older builds', async () => {
                localStorage.setItem('jwt-token', 'to-clear')
                await clearAuthToken()
                expect(localStorage.getItem('jwt-token')).toBeNull()
            })

            it('should also clear cookie defensively', async () => {
                await clearAuthToken()
                expect(mockCookies.remove).toHaveBeenCalledWith('jwt-token', { path: '/' })
            })

            it('should resolve even when the native clear fails', async () => {
                mockCapCookies.clearCookies.mockRejectedValue(new Error('bridge down'))
                await expect(clearAuthToken()).resolves.toBeUndefined()
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should remove cookie via js-cookie', () => {
                clearAuthToken()
                expect(mockCookies.remove).toHaveBeenCalledWith('jwt-token', { path: '/' })
            })

            it('should not touch the native jar', async () => {
                await clearAuthToken()
                expect(mockCapCookies.clearCookies).not.toHaveBeenCalled()
            })
        })
    })

    describe('getAuthHeaders', () => {
        it('returns no Authorization on capacitor — the cookie jar authenticates', () => {
            mockIsCapacitor.mockReturnValue(true)
            const headers = getAuthHeaders({ 'Content-Type': 'application/json' })
            expect(headers).toEqual({ 'Content-Type': 'application/json' })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should return Authorization header when token exists', () => {
                mockCookies.get.mockReturnValue('my-token')
                const headers = getAuthHeaders()
                expect(headers).toEqual({ Authorization: 'Bearer my-token' })
            })

            it('should return empty object when no token exists', () => {
                mockCookies.get.mockReturnValue(undefined)
                const headers = getAuthHeaders()
                expect(headers).toEqual({})
            })

            it('should merge extra headers when provided', () => {
                mockCookies.get.mockReturnValue('my-token')
                const headers = getAuthHeaders({ 'Content-Type': 'application/json', 'X-Custom': 'value' })
                expect(headers).toEqual({
                    Authorization: 'Bearer my-token',
                    'Content-Type': 'application/json',
                    'X-Custom': 'value',
                })
            })

            it('should return only extra headers when no token', () => {
                mockCookies.get.mockReturnValue(undefined)
                const headers = getAuthHeaders({ 'Content-Type': 'application/json' })
                expect(headers).toEqual({ 'Content-Type': 'application/json' })
            })
        })
    })
})
