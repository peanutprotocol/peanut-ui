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
