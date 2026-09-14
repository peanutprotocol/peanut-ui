import { getBinaryInfo } from '@/utils/app-version'

/**
 * Which binary a release version belongs to.
 *
 * Peanut's scheme is `<major>.<build>.<ota>` (scripts/release-version.mjs):
 * `<major>.<build>` names a native build and `<ota>` counts the JS shipped on
 * top of it, so the first two segments — and only those — say which binary a
 * bundle was built against. Staging bundles use the same shape with the commit
 * count as their `<ota>`, so they compare identically.
 */
export function nativeLine(version: string): [number, number] | null {
    const match = /^(\d+)\.(\d+)(?:\.|$)/.exec(version.trim())
    return match ? [Number(match[1]), Number(match[2])] : null
}

/**
 * Whether `bundleVersion` was built for a newer binary than `binaryVersion` —
 * i.e. only a store update can deliver it.
 *
 * Capgo already refuses the opposite direction on-device
 * (`disable_auto_update_under_native`); this is the direction nothing enforced.
 * A native release auto-publishes a matching `<major>.<build>.0` bundle so that
 * devices on the new binary have something to update to (TASK-21793), and that
 * bundle is built from the same commit as the binary — new plugins, permissions
 * and entitlements included. Delivered to an older shell it is JS calling
 * native code that install does not have, which fails silently.
 *
 * Fails OPEN on a version either side cannot be parsed. Capgo's own floor
 * (`min_update_version`) is the server-side half of this rule; refusing every
 * update because a version is off-scheme is the failure that killed OTA for the
 * fleet for a month, and it is strictly worse than the one this guards against.
 */
export function bundleNeedsNewerBinary(bundleVersion: string, binaryVersion: string): boolean {
    const bundle = nativeLine(bundleVersion)
    const binary = nativeLine(binaryVersion)
    if (!bundle || !binary) return false
    if (bundle[0] !== binary[0]) return bundle[0] > binary[0]
    return bundle[1] > binary[1]
}

/**
 * Same question, against the binary this install is actually running. False on
 * web and whenever the binary's own version cannot be read — see the fail-open
 * reasoning above.
 */
export async function needsStoreUpdate(bundleVersion: string): Promise<boolean> {
    const binary = await getBinaryInfo()
    if (!binary?.appVersion) return false
    return bundleNeedsNewerBinary(bundleVersion, binary.appVersion)
}
