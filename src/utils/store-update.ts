import { isAndroidNativeBridge, isIOSNativeBridge } from '@/utils/capacitor'
import { getStoreCountry } from '@/utils/store-country'

export const STORE_UPDATE_TIMEOUT_MS = 10_000
const MAX_PLAY_VERSION_CODE = 2_100_000_000

export type StoreUpdatePlatform = 'ios' | 'android'

export interface StoreUpdateOffer {
    platform: StoreUpdatePlatform
    installedVersion: string
    availableVersion: string
}

function versionParts(value: unknown): number[] | null {
    if (typeof value !== 'string' || value.length > 50 || !/^\d+(?:\.\d+){0,2}$/.test(value)) return null
    const parts = value.split('.').map(Number)
    return parts.every(Number.isSafeInteger) ? parts : null
}

function compareVersions(left: unknown, right: unknown): number | null {
    const a = versionParts(left)
    const b = versionParts(right)
    if (!a || !b) return null
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
        const difference = (a[index] ?? 0) - (b[index] ?? 0)
        if (difference) return difference
    }
    return 0
}

export function normalizeStoreVersion(platform: StoreUpdatePlatform, value: unknown): string | null {
    const parts = versionParts(value)
    if (!parts) return null
    if (platform === 'android')
        return parts.length === 1 && parts[0] > 0 && parts[0] <= MAX_PLAY_VERSION_CODE ? String(parts[0]) : null
    while (parts.length > 1 && parts.at(-1) === 0) parts.pop()
    return parts.join('.')
}

export function compareStoreVersions(platform: StoreUpdatePlatform, left: unknown, right: unknown): number | null {
    return compareVersions(normalizeStoreVersion(platform, left), normalizeStoreVersion(platform, right))
}

function toOffer(platform: StoreUpdatePlatform, installed: unknown, available: unknown): StoreUpdateOffer | null {
    const installedVersion = normalizeStoreVersion(platform, installed)
    const availableVersion = normalizeStoreVersion(platform, available)
    if (!installedVersion || !availableVersion || (compareVersions(availableVersion, installedVersion) ?? 0) <= 0)
        return null
    return { platform, installedVersion, availableVersion }
}

async function queryStoreUpdate(platform: StoreUpdatePlatform, signal: AbortSignal): Promise<StoreUpdateOffer | null> {
    const { CapacitorUpdater, AppUpdateAvailability } = await import('@capgo/capacitor-updater')
    if (signal.aborted) return null
    if (platform === 'android') {
        // Play knows this account's testing track, rollout and device eligibility.
        // Version codes are independent of the OTA and native marketing versions.
        const info = await CapacitorUpdater.getAppUpdateInfo()
        return info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
            ? toOffer(platform, info.currentVersionCode, info.availableVersionCode)
            : null
    }

    // The plugin defaults to the US storefront. That is not evidence that an
    // update exists for this Apple account. Missing bridge/country means no CTA.
    const country = await getStoreCountry()
    if (!country || signal.aborted) return null
    const info = await CapacitorUpdater.getAppUpdateInfo({ country: country.countryCode })
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE || signal.aborted) return null
    const offer = toOffer(platform, info.currentVersionName, info.availableVersionName)
    if (!offer) return null
    const { Device } = await import('@capacitor/device')
    if (signal.aborted) return null
    const device = await Device.getInfo()
    const osComparison = compareVersions(device.osVersion, info.minimumOsVersion)
    return osComparison !== null && osComparison >= 0 ? offer : null
}

/** Unknown/offline/old plugin responses must never send users to a store offering only Open. */
export async function getStoreUpdateOffer(): Promise<StoreUpdateOffer | null> {
    const platform = isIOSNativeBridge() ? 'ios' : isAndroidNativeBridge() ? 'android' : null
    if (!platform) return null
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            queryStoreUpdate(platform, controller.signal),
            new Promise<null>((resolve) => {
                timeout = setTimeout(() => {
                    controller.abort()
                    resolve(null)
                }, STORE_UPDATE_TIMEOUT_MS)
            }),
        ])
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}
