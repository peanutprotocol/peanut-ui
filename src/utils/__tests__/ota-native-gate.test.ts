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

const floors = (android: string, ios: string) => `abc1234 — some commit [ota-floors: android=${android} ios=${ios}]`

/**
 * The candidate's floors, read off the comment Capgo round-trips with it.
 *
 * One release tag names two binaries and the field does not keep them in step:
 * TestFlight has no auto-update, so iOS sat on 1.5.0 while Android moved to
 * 1.6.0, and every native input that changed between those releases was under
 * `android/`. The floors baked into a bundle describe the bundle that is
 * RUNNING, which is the wrong bundle to judge a candidate by — the two cases
 * this exists for are a pre-floor install taking its first floor-bearing bundle,
 * and a floor-bearing install refusing a candidate built after a native release
 * it knows nothing about.
 */
describe('needsStoreUpdate with candidate floors', () => {
    const load = async (platform: 'android' | 'ios', binary: string) => {
        jest.resetModules()
        jest.doMock('@/utils/capacitor', () => ({ isIOSNative: () => platform === 'ios' }))
        jest.doMock('@/utils/app-version', () => ({
            getBinaryInfo: async () => ({ appVersion: binary, appBuild: '1' }),
        }))
        return import('../ota-native-gate')
    }

    afterEach(() => {
        jest.dontMock('@/utils/capacitor')
        jest.dontMock('@/utils/app-version')
        jest.resetModules()
    })

    // The population this exists to unfreeze.
    it('lets an iOS 1.5.0 binary take a 1.6.x candidate whose iOS floor is 1.5.0', async () => {
        const { needsStoreUpdate } = await load('ios', '1.5.0')
        await expect(needsStoreUpdate('1.6.3', floors('1.6.0', '1.5.0'))).resolves.toBe(false)
    })

    it('still refuses that candidate on an Android 1.5.0 binary, whose floor is 1.6.0', async () => {
        const { needsStoreUpdate } = await load('android', '1.5.0')
        await expect(needsStoreUpdate('1.6.3', floors('1.6.0', '1.5.0'))).resolves.toBe(true)
    })

    // The inverse, and the reason the candidate has to be authoritative: judged
    // against the RUNNING bundle's floor (android 1.6.0) this device would accept
    // JS its binary cannot run.
    it('refuses a native-changing 1.7 candidate on the 1.6.0 binary it was not built for', async () => {
        const { needsStoreUpdate } = await load('android', '1.6.0')
        await expect(needsStoreUpdate('1.7.1', floors('1.7.0', '1.5.0'))).resolves.toBe(true)
    })

    it('lets the same 1.7 candidate through on iOS, which that release did not touch', async () => {
        const { needsStoreUpdate } = await load('ios', '1.5.0')
        await expect(needsStoreUpdate('1.7.1', floors('1.7.0', '1.5.0'))).resolves.toBe(false)
    })

    it('falls back to the candidate version when the comment carries no floors', async () => {
        const { needsStoreUpdate } = await load('ios', '1.5.0')
        await expect(needsStoreUpdate('1.6.3', 'abc1234 — a plain commit message')).resolves.toBe(true)
        await expect(needsStoreUpdate('1.6.3', undefined)).resolves.toBe(true)
        await expect(needsStoreUpdate('1.5.4', undefined)).resolves.toBe(false)
    })

    // A comment is a human string, and a loose parse of one reads a commit
    // message as a version. Both platforms or neither, plain X.Y.Z only.
    it.each([
        ['one platform only', 'abc1234 [ota-floors: android=1.6.0]'],
        ['a prerelease', 'abc1234 [ota-floors: android=1.6.0-rc1 ios=1.5.0]'],
        ['a bare mention', 'abc1234 bumped ota-floors for android'],
    ])('ignores a malformed marker — %s', async (_label, comment) => {
        const { parseCandidateFloors } = await load('ios', '1.5.0')
        expect(parseCandidateFloors(comment)).toBeNull()
    })

    it('reads the marker out of a comment that also carries the commit line', async () => {
        const { parseCandidateFloors } = await load('ios', '1.5.0')
        expect(parseCandidateFloors(floors('1.6.0', '1.5.0'))).toEqual({ android: '1.6.0', ios: '1.5.0' })
    })
})

/**
 * A different question from needsStoreUpdate, and the only one the baked
 * constants can answer honestly: this install is running JS built for a native
 * contract it does not have, so a store update is owed whether or not any new
 * bundle exists.
 */
describe('runningBundleOutranksBinary', () => {
    const load = async (platform: 'android' | 'ios', binary: string, baked?: { android: string; ios: string }) => {
        jest.resetModules()
        if (baked) {
            process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID = baked.android
            process.env.NEXT_PUBLIC_OTA_FLOOR_IOS = baked.ios
        }
        jest.doMock('@/utils/capacitor', () => ({ isIOSNative: () => platform === 'ios' }))
        jest.doMock('@/utils/app-version', () => ({
            getBinaryInfo: async () => ({ appVersion: binary, appBuild: '1' }),
        }))
        return import('../ota-native-gate')
    }

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID
        delete process.env.NEXT_PUBLIC_OTA_FLOOR_IOS
        jest.dontMock('@/utils/capacitor')
        jest.dontMock('@/utils/app-version')
        jest.resetModules()
    })

    it('is true when the binary is behind the running bundle floor', async () => {
        const m = await load('android', '1.5.0', { android: '1.6.0', ios: '1.5.0' })
        await expect(m.runningBundleOutranksBinary()).resolves.toBe(true)
    })

    it('is false when the binary clears it', async () => {
        const m = await load('ios', '1.5.0', { android: '1.6.0', ios: '1.5.0' })
        await expect(m.runningBundleOutranksBinary()).resolves.toBe(false)
    })

    it('is false on a bundle with no baked floors', async () => {
        const m = await load('android', '1.5.0')
        await expect(m.runningBundleOutranksBinary()).resolves.toBe(false)
    })
})
