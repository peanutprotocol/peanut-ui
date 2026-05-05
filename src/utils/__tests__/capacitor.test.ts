// tests for capacitor platform detection and api base url routing

// must be imported after mocks are set up
let isCapacitor: typeof import('../capacitor').isCapacitor
let isAndroidNative: typeof import('../capacitor').isAndroidNative
let isIOSNative: typeof import('../capacitor').isIOSNative
let getApiBaseUrl: typeof import('../capacitor').getApiBaseUrl
let getPlatform: typeof import('../capacitor').getPlatform

describe('capacitor utils', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
        delete (window as any).Capacitor
    })

    afterEach(() => {
        process.env = originalEnv
        delete (window as any).Capacitor
    })

    describe('isCapacitor', () => {
        it('should return false when no Capacitor object and no env var', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            ;({ isCapacitor } = require('../capacitor'))
            expect(isCapacitor()).toBe(false)
        })

        it('should return true when running on a native platform', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
            ;({ isCapacitor } = require('../capacitor'))
            expect(isCapacitor()).toBe(true)
        })

        it('should return true when NEXT_PUBLIC_CAPACITOR_BUILD is true', () => {
            process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
            ;({ isCapacitor } = require('../capacitor'))
            expect(isCapacitor()).toBe(true)
        })

        it('should return false when NEXT_PUBLIC_CAPACITOR_BUILD is not true', () => {
            process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
            ;({ isCapacitor } = require('../capacitor'))
            expect(isCapacitor()).toBe(false)
        })
    })

    describe('isAndroidNative', () => {
        it('should return true when Capacitor platform is android', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'android' }
            ;({ isAndroidNative } = require('../capacitor'))
            expect(isAndroidNative()).toBe(true)
        })

        it('should return false when Capacitor platform is ios', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'ios' }
            ;({ isAndroidNative } = require('../capacitor'))
            expect(isAndroidNative()).toBe(false)
        })

        it('should return false when not in capacitor', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            ;({ isAndroidNative } = require('../capacitor'))
            expect(isAndroidNative()).toBe(false)
        })
    })

    describe('isIOSNative', () => {
        it('should return true when Capacitor platform is ios', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'ios' }
            ;({ isIOSNative } = require('../capacitor'))
            expect(isIOSNative()).toBe(true)
        })

        it('should return false when Capacitor platform is android', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'android' }
            ;({ isIOSNative } = require('../capacitor'))
            expect(isIOSNative()).toBe(false)
        })

        it('should return false when not in capacitor', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            ;({ isIOSNative } = require('../capacitor'))
            expect(isIOSNative()).toBe(false)
        })
    })

    describe('getPlatform', () => {
        const originalNavigator = window.navigator
        const originalMatchMedia = window.matchMedia

        afterEach(() => {
            Object.defineProperty(window, 'matchMedia', { value: originalMatchMedia, writable: true })
            // reset navigator.standalone
            Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true })
        })

        // helper: mock matchMedia for standalone detection
        function mockStandalone(isStandalone: boolean) {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: jest.fn().mockImplementation((query: string) => ({
                    matches: query === '(display-mode: standalone)' ? isStandalone : false,
                    media: query,
                    addEventListener: jest.fn(),
                    removeEventListener: jest.fn(),
                })),
            })
        }

        // helper: mock user agent
        function mockUserAgent(ua: string) {
            Object.defineProperty(window.navigator, 'userAgent', {
                value: ua,
                configurable: true,
            })
        }

        it('should return android-native when Capacitor.getPlatform() returns android', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'android' }
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('android-native')
        })

        it('should return ios-native when Capacitor.getPlatform() returns ios', () => {
            ;(window as any).Capacitor = { getPlatform: () => 'ios' }
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('ios-native')
        })

        it('should return android-native via UA fallback when IS_CAPACITOR_BUILD + Android UA', () => {
            process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
            mockUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36')
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('android-native')
        })

        it('should return ios-native via UA fallback when IS_CAPACITOR_BUILD + iPhone UA', () => {
            process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
            mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15')
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('ios-native')
        })

        it('should return android-pwa when standalone + android UA', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            mockUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36')
            mockStandalone(true)
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('android-pwa')
        })

        it('should return ios-pwa when standalone + iphone UA', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15')
            mockStandalone(true)
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('ios-pwa')
        })

        it('should return web as default when no capacitor and not standalone', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            mockStandalone(false)
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('web')
        })
    })

    describe('getApiBaseUrl', () => {
        it('should return NEXT_PUBLIC_BASE_URL in capacitor mode', () => {
            process.env.NEXT_PUBLIC_BASE_URL = 'https://api.staging.peanut.me'
            ;(window as any).Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
            ;({ getApiBaseUrl } = require('../capacitor'))
            expect(getApiBaseUrl()).toBe('https://api.staging.peanut.me')
        })

        it('should return fallback url when NEXT_PUBLIC_BASE_URL is not set in capacitor mode', () => {
            delete process.env.NEXT_PUBLIC_BASE_URL
            ;(window as any).Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
            ;({ getApiBaseUrl } = require('../capacitor'))
            expect(getApiBaseUrl()).toBe('https://peanut.me')
        })

        it('should return empty string in web mode', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            ;({ getApiBaseUrl } = require('../capacitor'))
            expect(getApiBaseUrl()).toBe('')
        })
    })
})
