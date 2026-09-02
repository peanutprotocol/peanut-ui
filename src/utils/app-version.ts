import { isCapacitor } from '@/utils/capacitor'

export interface BinaryInfo {
    appVersion: string
    appBuild: string
}

/**
 * The version the native shell actually ships, read off the binary.
 *
 * package.json's version does NOT track releases — ios-release.yml and
 * android-release.yml stamp MARKETING_VERSION / versionName from the release
 * workflow's input, which is why a 1.1.0 build reported 1.0.53 in About.
 * Returns nulls on web, where there is no binary to ask.
 */
export async function getBinaryInfo(): Promise<BinaryInfo | null> {
    if (!isCapacitor()) return null
    try {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        return { appVersion: info.version, appBuild: info.build }
    } catch {
        return null
    }
}

/**
 * How the app version reads on screen: `<major>.<build>.<ota>.<ci-build>`.
 *
 * The first three segments are `appVersion` verbatim — Peanut's release scheme
 * (scripts/release-version.mjs): major generation, native build counter, and
 * the OTA counter within that build. None of them may be replaced: overwriting
 * the third would name an OTA revision that never shipped.
 *
 * The CI build number is appended as a fourth segment rather than parenthesised
 * so the whole identifier reads as one string a user can dictate. It is the
 * release workflow's run number, and it is NOT comparable across platforms:
 * android-release.yml sets the version code to `10000 + run_number` while
 * ios-release.yml uses the run number as-is, so the same release shows a
 * ~10000 gap between an Android and an iOS device. That is a property of the
 * build numbering, not of this format — it identifies a build, not an ordering.
 */
export function formatBinaryVersion({ appVersion, appBuild }: BinaryInfo): string {
    if (!appVersion) return appBuild
    if (!appBuild) return appVersion
    return `${appVersion}.${appBuild}`
}
