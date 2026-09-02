// tests for capacitor platform detection and api base url routing

// must be imported after mocks are set up
let isCapacitor: typeof import('../capacitor').isCapacitor
let isAndroidNative: typeof import('../capacitor').isAndroidNative
let isIOSNative: typeof import('../capacitor').isIOSNative
let getApiBaseUrl: typeof import('../capacitor').getApiBaseUrl
let getPlatform: typeof import('../capacitor').getPlatform

const mockGetInfo = jest.fn()
jest.mock('@capacitor/device', () => ({ Device: { getInfo: () => mockGetInfo() } }))
const mockBrowserClose = jest.fn()
jest.mock('@capacitor/browser', () => ({
    Browser: { open: jest.fn(() => Promise.resolve()), close: () => mockBrowserClose() },
}))

describe('capacitor utils', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
        delete window.Capacitor
    })

    afterEach(() => {
        process.env = originalEnv
        delete window.Capacitor
    })

    describe('isCapacitor', () => {
        it('should return false when no Capacitor object and no env var', () => {
            delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
            ;({ isCapacitor } = require('../capacitor'))
            expect(isCapacitor()).toBe(false)
        })

        it('should return true when running on a native platform', () => {
            window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
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
            window.Capacitor = { getPlatform: () => 'android' }
            ;({ isAndroidNative } = require('../capacitor'))
            expect(isAndroidNative()).toBe(true)
        })

        it('should return false when Capacitor platform is ios', () => {
            window.Capacitor = { getPlatform: () => 'ios' }
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
            window.Capacitor = { getPlatform: () => 'ios' }
            ;({ isIOSNative } = require('../capacitor'))
            expect(isIOSNative()).toBe(true)
        })

        it('should return false when Capacitor platform is android', () => {
            window.Capacitor = { getPlatform: () => 'android' }
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
            window.Capacitor = { getPlatform: () => 'android' }
            ;({ getPlatform } = require('../capacitor'))
            expect(getPlatform()).toBe('android-native')
        })

        it('should return ios-native when Capacitor.getPlatform() returns ios', () => {
            window.Capacitor = { getPlatform: () => 'ios' }
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
            window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
            ;({ getApiBaseUrl } = require('../capacitor'))
            expect(getApiBaseUrl()).toBe('https://api.staging.peanut.me')
        })

        it('should return fallback url when NEXT_PUBLIC_BASE_URL is not set in capacitor mode', () => {
            delete process.env.NEXT_PUBLIC_BASE_URL
            window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
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

describe('isWebViewCssSupported', () => {
    const win = window as unknown as Record<string, unknown>
    const setCanary = (layer: boolean, property: boolean, colorMix: boolean) => {
        if (layer) win.CSSLayerBlockRule = class {}
        else delete win.CSSLayerBlockRule
        if (property) win.CSSPropertyRule = class {}
        else delete win.CSSPropertyRule
        win.CSS = { supports: jest.fn(() => colorMix) }
    }

    afterEach(() => {
        delete win.CSSLayerBlockRule
        delete win.CSSPropertyRule
        delete win.CSS
    })

    it('passes when @layer, @property and color-mix(in oklab) are all present', () => {
        setCanary(true, true, true)
        const { isWebViewCssSupported } = require('../capacitor')
        expect(isWebViewCssSupported()).toBe(true)
        expect((win.CSS as { supports: jest.Mock }).supports).toHaveBeenCalledWith(
            'color',
            'color-mix(in oklab, red, red)'
        )
    })

    it.each([
        ['@layer', [false, true, true]],
        ['@property', [true, false, true]],
        ['color-mix', [true, true, false]],
    ] as const)('fails when %s is missing', (_name, [layer, property, colorMix]) => {
        setCanary(layer, property, colorMix)
        const { isWebViewCssSupported } = require('../capacitor')
        expect(isWebViewCssSupported()).toBe(false)
    })

    it('fails when the CSS object itself is missing', () => {
        setCanary(true, true, true)
        delete win.CSS
        const { isWebViewCssSupported } = require('../capacitor')
        expect(isWebViewCssSupported()).toBe(false)
    })
})

describe('androidSdkFromUserAgent', () => {
    const { androidSdkFromUserAgent } = require('../capacitor') as typeof import('../capacitor')

    it.each([
        ['Mozilla/5.0 (Linux; Android 9; Pixel) AppleWebKit/537.36', 28],
        ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 29],
        ['Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36', 30],
        ['Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36', 31],
        ['Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36', 33],
        ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36', 34],
        ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36', 35],
        ['Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36', 36],
    ])('%s → %i', (ua, sdk) => {
        expect(androidSdkFromUserAgent(ua)).toBe(sdk)
    })

    it.each([
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Mozilla/5.0 (Linux; Android 8.1.0; Nexus) AppleWebKit/537.36',
        'Mozilla/5.0 (Linux; Android 99; Future) AppleWebKit/537.36',
        'Mozilla/5.0 (Linux; Android; K) AppleWebKit/537.36',
        '',
    ])('returns null for %s', (ua) => {
        expect(androidSdkFromUserAgent(ua)).toBeNull()
    })
})

describe('legacy android safe-area zeroing', () => {
    const edges = ['top', 'right', 'bottom', 'left']
    const inline = () =>
        edges.map((edge) => document.documentElement.style.getPropertyValue(`--safe-area-inset-${edge}`))
    const setUserAgent = (ua: string) =>
        Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
    const originalUserAgent = navigator.userAgent

    beforeEach(() => {
        jest.resetModules()
        mockGetInfo.mockReset()
        for (const edge of edges) document.documentElement.style.removeProperty(`--safe-area-inset-${edge}`)
    })

    afterEach(() => {
        setUserAgent(originalUserAgent)
        delete window.Capacitor
    })

    it('zeroes the four inline insets synchronously on Android < 15', () => {
        window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true }
        setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36')
        const { applyLegacyAndroidSafeAreaZeroFromUserAgent } = require('../capacitor')
        applyLegacyAndroidSafeAreaZeroFromUserAgent()
        expect(inline()).toEqual(['0px', '0px', '0px', '0px'])
    })

    it.each([
        ['Android 15', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36'],
        ['an unmapped version', 'Mozilla/5.0 (Linux; Android 8.1.0; Nexus) AppleWebKit/537.36'],
    ])('leaves the insets alone on %s', (_name, ua) => {
        window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true }
        setUserAgent(ua)
        const { applyLegacyAndroidSafeAreaZeroFromUserAgent } = require('../capacitor')
        applyLegacyAndroidSafeAreaZeroFromUserAgent()
        expect(inline()).toEqual(['', '', '', ''])
    })

    it('does nothing outside android native even with an Android UA', () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36')
        const { applyLegacyAndroidSafeAreaZeroFromUserAgent } = require('../capacitor')
        applyLegacyAndroidSafeAreaZeroFromUserAgent()
        expect(inline()).toEqual(['', '', '', ''])
    })

    it('the Device pass clears a UA-based zeroing when the device reports SDK 35+', async () => {
        window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true }
        setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')
        mockGetInfo.mockResolvedValue({ androidSDKVersion: 35 })
        const { applyLegacyAndroidSafeAreaZeroFromUserAgent, zeroLegacyAndroidSafeAreaInsets } = require('../capacitor')
        applyLegacyAndroidSafeAreaZeroFromUserAgent()
        expect(inline()).toEqual(['0px', '0px', '0px', '0px'])
        await zeroLegacyAndroidSafeAreaInsets()
        expect(inline()).toEqual(['', '', '', ''])
    })

    it('the Device pass zeroes when the device reports SDK < 35', async () => {
        window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true }
        mockGetInfo.mockResolvedValue({ androidSDKVersion: 33 })
        const { zeroLegacyAndroidSafeAreaInsets } = require('../capacitor')
        await zeroLegacyAndroidSafeAreaInsets()
        expect(inline()).toEqual(['0px', '0px', '0px', '0px'])
    })

    it('the Device pass keeps the env() seed when the sdk is unknown', async () => {
        window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true }
        mockGetInfo.mockResolvedValue({})
        const { zeroLegacyAndroidSafeAreaInsets } = require('../capacitor')
        await zeroLegacyAndroidSafeAreaInsets()
        expect(inline()).toEqual(['', '', '', ''])
    })
})

describe('closeInAppBrowser', () => {
    beforeEach(() => {
        jest.resetModules()
        mockBrowserClose.mockReset()
        window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
    })

    afterEach(() => {
        delete window.Capacitor
    })

    it('dispatches the closed event once the sheet it opened is closed', async () => {
        mockBrowserClose.mockResolvedValue(undefined)
        const cap = require('../capacitor') as typeof import('../capacitor')
        const onClosed = jest.fn()
        document.addEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
        await cap.openExternalUrl('https://example.com')
        await cap.closeInAppBrowser()
        expect(mockBrowserClose).toHaveBeenCalledTimes(1)
        expect(onClosed).toHaveBeenCalledTimes(1)
        // already closed: neither the plugin nor the event fire again
        await cap.closeInAppBrowser()
        expect(mockBrowserClose).toHaveBeenCalledTimes(1)
        expect(onClosed).toHaveBeenCalledTimes(1)
        document.removeEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
    })

    it('still dispatches when the plugin close rejects (sheet already gone)', async () => {
        mockBrowserClose.mockRejectedValue(new Error('no browser'))
        const cap = require('../capacitor') as typeof import('../capacitor')
        const onClosed = jest.fn()
        document.addEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
        await cap.openExternalUrl('https://example.com')
        await expect(cap.closeInAppBrowser()).resolves.toBeUndefined()
        expect(onClosed).toHaveBeenCalledTimes(1)
        document.removeEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
    })

    it('does not dispatch when no sheet was opened', async () => {
        const cap = require('../capacitor') as typeof import('../capacitor')
        const onClosed = jest.fn()
        document.addEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
        await cap.closeInAppBrowser()
        expect(onClosed).not.toHaveBeenCalled()
        document.removeEventListener(cap.IN_APP_BROWSER_CLOSED_EVENT, onClosed)
    })
})
