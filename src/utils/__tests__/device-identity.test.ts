/**
 * Chrome's UA reduction leaves PostHog resolving every Android to the literal
 * `$device` "Android" with no `$os_version` (4 of 19,151 events carried one in
 * the 14 days to 2026-09-04), so a slow-device cohort cannot be built from the
 * built-in context. These cover the two sources that see through it and the
 * classifier's deliberate refusal to rank WebKit devices.
 */

import { classifyDevice } from '../device-identity'

const mockIsNativeBridge = jest.fn()
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => mockIsNativeBridge() }))

const mockGetInfo = jest.fn()
jest.mock('@capacitor/device', () => ({ Device: { getInfo: (...a: unknown[]) => mockGetInfo(...a) } }))

function stubNavigator(props: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(props)) {
        Object.defineProperty(navigator, key, { value, configurable: true, writable: true })
    }
}

/** Fresh registry per test — the resolved identity is memoized per document. */
async function freshResolve() {
    let resolve!: typeof import('../device-identity').resolveDeviceIdentity
    jest.isolateModules(() => {
        resolve = require('../device-identity').resolveDeviceIdentity
    })
    return resolve()
}

describe('classifyDevice', () => {
    it.each([
        [0.5, 'low'],
        [2, 'low'],
        [4, 'mid'],
        [8, 'high'],
    ])('buckets %s GB as %s', (memory, expected) => {
        expect(classifyDevice(memory as number)).toBe(expected)
    })

    /*
     * WebKit exposes no memory, and its core count is small on fast hardware —
     * an iPhone reports fewer cores than a budget Android while turning in an
     * INP p75 of 96 ms against that Android's 224 ms. Ranking iOS on either
     * signal would file every iPhone as slow, so it stays unknown and is
     * segmented by device_model / device_screen instead.
     */
    it('refuses to rank a device that reports no memory', () => {
        expect(classifyDevice(undefined)).toBe('unknown')
    })
})

describe('resolveDeviceIdentity', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsNativeBridge.mockReturnValue(false)
        stubNavigator({ deviceMemory: undefined, hardwareConcurrency: 8, userAgentData: undefined })
    })

    it('reads the exact hardware from the native bridge', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockGetInfo.mockResolvedValue({
            model: 'iPhone14,3',
            manufacturer: 'Apple',
            osVersion: '18.5',
            webViewVersion: '18.5',
        })

        await expect(freshResolve()).resolves.toEqual(
            expect.objectContaining({
                device_model: 'iPhone14,3',
                device_manufacturer: 'Apple',
                device_os_version: '18.5',
                device_webview_version: '18.5',
            })
        )
    })

    // The point of the whole module: without high-entropy hints the model is
    // unrecoverable on Android, which is the platform with the INP problem.
    it('recovers the Android model and OS version from client hints', async () => {
        const getHighEntropyValues = jest.fn().mockResolvedValue({ model: 'SM-A505G', platformVersion: '11.0.0' })
        stubNavigator({ userAgentData: { getHighEntropyValues }, deviceMemory: 2 })

        await expect(freshResolve()).resolves.toEqual(
            expect.objectContaining({
                device_model: 'SM-A505G',
                device_os_version: '11.0.0',
                device_memory_gb: 2,
                device_class: 'low',
            })
        )
        expect(getHighEntropyValues).toHaveBeenCalledWith(['model', 'platformVersion'])
    })

    // Desktop Chromium answers with an empty model rather than omitting it, and
    // an empty string would read as a real value in a breakdown.
    it('drops an empty model rather than reporting it', async () => {
        stubNavigator({
            userAgentData: {
                getHighEntropyValues: jest.fn().mockResolvedValue({ model: '', platformVersion: '15.0' }),
            },
        })

        const identity = await freshResolve()
        expect(identity.device_model).toBeUndefined()
        expect(identity.device_os_version).toBe('15.0')
    })

    // An older binary without the plugin, or a browser that refuses the hints:
    // the buckets we already have are still worth reporting on their own.
    it('keeps the browser-side buckets when the identity source throws', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockGetInfo.mockRejectedValue(new Error('plugin not implemented'))
        stubNavigator({ deviceMemory: 4, hardwareConcurrency: 4 })

        await expect(freshResolve()).resolves.toEqual(
            expect.objectContaining({ device_class: 'mid', device_memory_gb: 4, device_cores: 4 })
        )
    })

    it('reports the screen so iOS PWAs are separable without a model', async () => {
        Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
        Object.defineProperty(window.screen, 'width', { value: 390, configurable: true })
        Object.defineProperty(window.screen, 'height', { value: 844, configurable: true })

        await expect(freshResolve()).resolves.toEqual(expect.objectContaining({ device_screen: '390x844@3' }))
    })
})
