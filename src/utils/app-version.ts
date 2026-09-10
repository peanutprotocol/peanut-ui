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
 * The user-facing release version of the code actually running.
 *
 * Peanut's three segments are `<major>.<native-build>.<ota>`. On an OTA'd
 * install the Capgo bundle owns that version; otherwise the native shell does.
 * `appBuild` is a separate platform/CI identifier used by the stores and support
 * diagnostics. Appending it as a fourth dotted segment (for example,
 * `1.5.0.21653381`) makes it look like part of the comparable release version.
 */
export function formatRunningVersion({ appVersion, otaVersion }: RunningVersionInfo): string {
    return otaVersion || appVersion
}
