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
