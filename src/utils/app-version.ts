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
 * How the app version reads on screen: `<major>.<minor>.<build>`.
 *
 * The build number takes the patch position because it is the digit that
 * actually moves between releases — the marketing version is stamped by hand
 * from the release workflow's input, while the build is the workflow run
 * number, so `1.1.1 (34534)` showed a patch digit that had not changed in
 * months next to the only number identifying the build.
 *
 * A binary reporting fewer than two version segments keeps the old
 * `<version> (<build>)` shape rather than rendering `undefined` into the digit
 * a support conversation depends on.
 */
export function formatBinaryVersion({ appVersion, appBuild }: BinaryInfo): string {
    const [major, minor] = appVersion.split('.')
    return major && minor ? `${major}.${minor}.${appBuild}` : `${appVersion} (${appBuild})`
}
