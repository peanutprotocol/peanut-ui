// tests for auth-token jwt management (web vs capacitor)

import Cookies from 'js-cookie'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

jest.mock('js-cookie', () => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
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

import { getAuthToken, setAuthToken, clearAuthToken, getAuthHeaders } from '../auth-token'

describe('auth-token', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
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

            it('should read from localStorage', () => {
                localStorage.setItem('jwt-token', 'cap-token-123')
                expect(getAuthToken()).toBe('cap-token-123')
            })

            it('should return null when localStorage is empty and no cookie', () => {
                mockCookies.get.mockReturnValue(undefined)
                expect(getAuthToken()).toBeNull()
            })

            it('should migrate from cookie to localStorage when localStorage is empty', () => {
                mockCookies.get.mockReturnValue('migrated-token')
                const token = getAuthToken()
                expect(token).toBe('migrated-token')
                expect(localStorage.getItem('jwt-token')).toBe('migrated-token')
            })

            it('should prefer localStorage over cookie when both exist', () => {
                localStorage.setItem('jwt-token', 'local-token')
                mockCookies.get.mockReturnValue('cookie-token')
                expect(getAuthToken()).toBe('local-token')
                // cookie.get should not have been called since localStorage had a value
                expect(mockCookies.get).not.toHaveBeenCalled()
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

            it('should save to localStorage', () => {
                setAuthToken('new-cap-token')
                expect(localStorage.getItem('jwt-token')).toBe('new-cap-token')
            })

            it('should not set a cookie', () => {
                setAuthToken('new-cap-token')
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

    describe('clearAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('should remove from localStorage', () => {
                localStorage.setItem('jwt-token', 'to-clear')
                clearAuthToken()
                expect(localStorage.getItem('jwt-token')).toBeNull()
            })

            it('should also clear cookie defensively', () => {
                clearAuthToken()
                expect(mockCookies.remove).toHaveBeenCalledWith('jwt-token', { path: '/' })
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

            it('should not attempt to remove from localStorage', () => {
                const spy = jest.spyOn(Storage.prototype, 'removeItem')
                clearAuthToken()
                expect(spy).not.toHaveBeenCalled()
                spy.mockRestore()
            })
        })
    })

    describe('getAuthHeaders', () => {
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
