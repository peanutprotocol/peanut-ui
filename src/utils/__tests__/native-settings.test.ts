/** @jest-environment jsdom */
/**
 * The QR scanner's "Open Settings" button. capacitor-native-settings is native
 * code, so an OTA'd bundle can run on a binary that predates it — these pin the
 * feature check and the iOS-only `app-settings:` route that covers that gap.
 */
import { canOpenAppSettings, openAppSettings } from '../native-settings'

const mockOpen = jest.fn()
jest.mock('capacitor-native-settings', () => ({
    NativeSettings: { open: (...args: unknown[]) => mockOpen(...args) },
    AndroidSettings: { ApplicationDetails: 'application_details' },
    IOSSettings: { App: 'app' },
}))

function setBridge(options: { platform?: string; native?: boolean; plugin?: boolean } = {}) {
    const { platform = 'ios', native = true, plugin = true } = options
    window.Capacitor = {
        getPlatform: () => platform,
        isNativePlatform: () => native,
        isPluginAvailable: (name: string) => plugin && name === 'NativeSettings',
    }
}

describe('canOpenAppSettings', () => {
    afterEach(() => {
        delete window.Capacitor
        jest.clearAllMocks()
    })

    it('is false on web', () => {
        expect(canOpenAppSettings()).toBe(false)
    })

    it('is false on a capacitor-flavoured build with no live bridge', () => {
        setBridge({ native: false })
        expect(canOpenAppSettings()).toBe(false)
    })

    it('is true on either platform once the plugin is in the binary', () => {
        setBridge({ platform: 'android' })
        expect(canOpenAppSettings()).toBe(true)
        setBridge({ platform: 'ios' })
        expect(canOpenAppSettings()).toBe(true)
    })

    it('stays true on an iOS binary without the plugin, false on Android', () => {
        setBridge({ platform: 'ios', plugin: false })
        expect(canOpenAppSettings()).toBe(true)
        setBridge({ platform: 'android', plugin: false })
        expect(canOpenAppSettings()).toBe(false)
    })
})

describe('openAppSettings', () => {
    const assign = jest.fn()

    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                get href() {
                    return 'http://localhost/'
                },
                set href(value: string) {
                    assign(value)
                },
            },
        })
    })

    afterEach(() => {
        delete window.Capacitor
        jest.clearAllMocks()
    })

    it('asks the plugin for the app-details screen on android', async () => {
        setBridge({ platform: 'android' })
        mockOpen.mockResolvedValue({ status: true })
        await expect(openAppSettings()).resolves.toBe(true)
        expect(mockOpen).toHaveBeenCalledWith({ optionAndroid: 'application_details', optionIOS: 'app' })
        expect(assign).not.toHaveBeenCalled()
    })

    it('navigates to app-settings: when the iOS binary predates the plugin', async () => {
        setBridge({ platform: 'ios', plugin: false })
        await expect(openAppSettings()).resolves.toBe(true)
        expect(mockOpen).not.toHaveBeenCalled()
        expect(assign).toHaveBeenCalledWith('app-settings:')
    })

    it('falls back to the iOS navigation when the plugin call fails', async () => {
        setBridge({ platform: 'ios' })
        mockOpen.mockRejectedValue(new Error('not implemented'))
        await expect(openAppSettings()).resolves.toBe(true)
        expect(assign).toHaveBeenCalledWith('app-settings:')
    })

    it('reports failure on android when the plugin refuses, rather than navigating', async () => {
        setBridge({ platform: 'android' })
        mockOpen.mockResolvedValue({ status: false })
        await expect(openAppSettings()).resolves.toBe(false)
        expect(assign).not.toHaveBeenCalled()
    })

    it('does nothing on web', async () => {
        await expect(openAppSettings()).resolves.toBe(false)
        expect(mockOpen).not.toHaveBeenCalled()
        expect(assign).not.toHaveBeenCalled()
    })
})
