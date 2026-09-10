/**
 * Which bundles a given binary is allowed to run. The version scheme is
 * `<major>.<build>.<ota>` (scripts/release-version.mjs), so `<major>.<build>`
 * is the binary a bundle was built against and the `<ota>` segment carries no
 * compatibility information at all.
 */
import { bundleNeedsNewerBinary, nativeLine } from '../ota-native-gate'

describe('nativeLine', () => {
    it('reads the binary half of a release version', () => {
        expect(nativeLine('1.6.0')).toEqual([1, 6])
        expect(nativeLine('1.5.3')).toEqual([1, 5])
        // staging bundles carry the commit count as their ota segment
        expect(nativeLine('1.6.10482')).toEqual([1, 6])
        // a bare native version, as App.getInfo() can report it
        expect(nativeLine('1.6')).toEqual([1, 6])
    })

    it('rejects anything off-scheme', () => {
        expect(nativeLine('builtin')).toBeNull()
        expect(nativeLine('')).toBeNull()
        expect(nativeLine('v1.6.0')).toBeNull()
    })
})

describe('bundleNeedsNewerBinary', () => {
    it('blocks a bundle built for a newer native build', () => {
        // the case that shipped: an install reading 1.5.3 is still the 1.5.0 binary
        expect(bundleNeedsNewerBinary('1.6.0', '1.5.0')).toBe(true)
        expect(bundleNeedsNewerBinary('2.0.0', '1.9.0')).toBe(true)
    })

    it('allows every OTA inside the running binary build', () => {
        expect(bundleNeedsNewerBinary('1.5.4', '1.5.0')).toBe(false)
        expect(bundleNeedsNewerBinary('1.5.0', '1.5.0')).toBe(false)
        // staging's commit-count band sits far above production's, and still
        // targets the same binary
        expect(bundleNeedsNewerBinary('1.5.10482', '1.5.0')).toBe(false)
    })

    it('leaves the below-native direction to Capgo', () => {
        expect(bundleNeedsNewerBinary('1.4.9', '1.5.0')).toBe(false)
    })

    it('fails open on a version it cannot read', () => {
        // refusing every update on an unparseable version is the failure that
        // killed OTA for the fleet for a month (TASK-21793)
        expect(bundleNeedsNewerBinary('builtin', '1.5.0')).toBe(false)
        expect(bundleNeedsNewerBinary('1.6.0', '')).toBe(false)
    })
})

/**
 * Per-platform floors. One release tag names two binaries and the field does not
 * keep them in step — TestFlight has no auto-update, so iOS sat on 1.5.0 while
 * Android moved to 1.6.0, and every native input that changed between those
 * releases was under `android/`. Read as a version number, bundle 1.6.x refuses
 * the whole iOS population JS its binary runs; read as a surface, iOS's floor is
 * 1.5.0. The floors are baked in at publish time by ota-platform-floor.mjs.
 */
describe('needsStoreUpdate with baked platform floors', () => {
    const load = async ({
        android,
        ios,
        platform,
    }: {
        android?: string
        ios?: string
        platform: 'android' | 'ios'
    }) => {
        jest.resetModules()
        process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID = android
        process.env.NEXT_PUBLIC_OTA_FLOOR_IOS = ios
        if (android === undefined) delete process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID
        if (ios === undefined) delete process.env.NEXT_PUBLIC_OTA_FLOOR_IOS
        jest.doMock('@/utils/capacitor', () => ({ isIOSNative: () => platform === 'ios' }))
        jest.doMock('@/utils/app-version', () => ({
            getBinaryInfo: async () => ({ appVersion: binaryVersion, appBuild: '1' }),
        }))
        return import('../ota-native-gate')
    }
    let binaryVersion = '1.5.0'

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID
        delete process.env.NEXT_PUBLIC_OTA_FLOOR_IOS
        jest.dontMock('@/utils/capacitor')
        jest.dontMock('@/utils/app-version')
        jest.resetModules()
    })

    // The case that would otherwise freeze every iOS install, silently: the store
    // row is hidden while the App Store listing is not live, so there is not even
    // a prompt to explain why updates stopped.
    it('serves a 1.6.x bundle to an iOS 1.5.0 binary when the iOS floor is 1.5.0', async () => {
        binaryVersion = '1.5.0'
        const { needsStoreUpdate } = await load({ android: '1.6.0', ios: '1.5.0', platform: 'ios' })
        await expect(needsStoreUpdate('1.6.2')).resolves.toBe(false)
    })

    it('still refuses the same bundle on an Android 1.5.0 binary, whose floor is 1.6.0', async () => {
        binaryVersion = '1.5.0'
        const { needsStoreUpdate } = await load({ android: '1.6.0', ios: '1.5.0', platform: 'android' })
        await expect(needsStoreUpdate('1.6.2')).resolves.toBe(true)
    })

    it('reads the floor for the running platform, not the other one', async () => {
        binaryVersion = '1.6.0'
        const onAndroid = await load({ android: '1.6.0', ios: '1.5.0', platform: 'android' })
        await expect(onAndroid.needsStoreUpdate('1.6.2')).resolves.toBe(false)
    })

    // Bundles published before the floors existed carry neither value, and must
    // behave exactly as they did.
    it('falls back to the candidate version when no floor is baked in', async () => {
        binaryVersion = '1.5.0'
        const { needsStoreUpdate } = await load({ platform: 'ios' })
        await expect(needsStoreUpdate('1.6.2')).resolves.toBe(true)
        await expect(needsStoreUpdate('1.5.4')).resolves.toBe(false)
    })

    it('falls back when the baked value is not on the version scheme', async () => {
        binaryVersion = '1.5.0'
        const { needsStoreUpdate } = await load({ android: 'unknown', ios: 'unknown', platform: 'android' })
        await expect(needsStoreUpdate('1.6.2')).resolves.toBe(true)
    })
})
