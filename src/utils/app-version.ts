import { isCapacitor } from '@/utils/capacitor'

export interface BinaryInfo {
    appVersion: string
    appBuild: string
}

export interface RunningVersionInfo extends BinaryInfo {
    /** Capgo bundle actually executing, or null when it is the JS baked into the binary */
    otaVersion: string | null
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

// Capgo's name for the JS baked into the binary; some plugin versions report it
// as the bundle id, others as its version.
const BUILTIN_BUNDLE = 'builtin'

/**
 * The Capgo bundle currently executing, when it is not the binary's own JS.
 *
 * Null on the builtin bundle so the binary's version stays the answer there:
 * Capgo echoes the native version for builtin on some plugin versions and the
 * literal "builtin" on others, and neither is worth preferring over App.getInfo().
 */
async function getOtaBundleVersion(): Promise<string | null> {
    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
        const bundle = (await CapacitorUpdater.current())?.bundle
        if (!bundle || bundle.id === BUILTIN_BUNDLE || bundle.version === BUILTIN_BUNDLE) return null
        return bundle.version || null
    } catch {
        return null
    }
}

/** What this install is actually running: the binary, plus the OTA layered on it. */
export async function getRunningVersion(): Promise<RunningVersionInfo | null> {
    const binary = await getBinaryInfo()
    if (!binary) return null
    return { ...binary, otaVersion: await getOtaBundleVersion() }
}

/**
 * How the app version reads on screen: `<major>.<build>.<ota>.<ci-build>`.
 *
 * The first three segments are the release version of the code that is running
 * — Peanut's scheme (scripts/release-version.mjs): major generation, native
 * build counter, and the OTA counter within that build. On an OTA'd install
 * that is the bundle's version, not the binary's: the binary is frozen at the
 * `.0` it shipped with, so reporting it would name a revision the user stopped
 * running the moment the OTA applied.
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

export function formatRunningVersion({ appVersion, appBuild, otaVersion }: RunningVersionInfo): string {
    return formatBinaryVersion({ appVersion: otaVersion || appVersion, appBuild })
}
