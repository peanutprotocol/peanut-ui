import { getBinaryInfo } from '@/utils/app-version'
import { isIOSNative } from '@/utils/capacitor'

/**
 * The oldest native build of each platform this bundle may run on, baked in at
 * publish time by `scripts/ota-platform-floor.mjs`.
 *
 * A bundle's own version cannot answer the question. One release tag names two
 * binaries, and the field does not keep them in step: TestFlight has no
 * auto-update, so iOS sat on 1.5.0 while Android moved to 1.6.0 — and every
 * native input that changed between those releases was under `android/`. Read
 * as a number, bundle 1.6.x "needs a 1.6 binary" and the whole iOS population
 * is refused JS its binary runs perfectly. Read as a surface, iOS's floor is
 * 1.5.0 and Android's is 1.6.0, which is the truth.
 *
 * Absent on bundles published before the floors existed, and on web. Direct
 * member access on purpose — Next inlines `process.env.NEXT_PUBLIC_*` at build
 * time only when it is written literally.
 */
const OTA_FLOOR = {
    android: process.env.NEXT_PUBLIC_OTA_FLOOR_ANDROID,
    ios: process.env.NEXT_PUBLIC_OTA_FLOOR_IOS,
}

/** The baked floor for the platform this install is running on, if it has one. */
function platformFloor(): string | null {
    const floor = isIOSNative() ? OTA_FLOOR.ios : OTA_FLOOR.android
    return floor && nativeLine(floor) ? floor : null
}

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
 * Whether this install needs a store update before it can run the JS on offer.
 *
 * Answered against the running bundle's baked floor for THIS platform when it
 * has one, and against the candidate's own version otherwise. The floor is the
 * better question of the two — it is derived from the native surface rather
 * than from a number that cannot distinguish the platforms — and the fallback
 * keeps behaviour unchanged for bundles published before the floors existed.
 *
 * The floor describes the RUNNING bundle, not the candidate: nothing in Capgo's
 * getLatest() response carries a candidate's `min_update_version`, so a device
 * cannot learn it before downloading. Across a native-release boundary that
 * makes this permissive rather than restrictive — a device whose binary clears
 * the running bundle's floor may still be offered a bundle built against a newer
 * release. The server is what closes that: `min_update_version` per bundle,
 * enforced under the channel's `metadata` strategy, and exactly per-platform once
 * the two production channels land (docs/NATIVE-RELEASE.md). Permissive is the
 * right side to err on for the client half — the alternative refuses the whole
 * iOS population an update its binary can run, silently, because the App Store
 * listing is not live and there is no prompt to show it.
 *
 * False on web and whenever the binary's own version cannot be read — see the
 * fail-open reasoning above.
 */
export async function needsStoreUpdate(bundleVersion: string): Promise<boolean> {
    const binary = await getBinaryInfo()
    if (!binary?.appVersion) return false
    return bundleNeedsNewerBinary(platformFloor() ?? bundleVersion, binary.appVersion)
}
