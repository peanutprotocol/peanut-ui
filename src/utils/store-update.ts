import { isCapacitor, isIOSNative } from '@/utils/capacitor'
import { getStoreCountry } from '@/utils/store-country'

export const STORE_UPDATE_TIMEOUT_MS = 10_000

function versionParts(value: unknown): number[] | null {
    if (typeof value !== 'string' || !/^\d+(?:\.\d+){0,2}$/.test(value)) return null
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

async function queryStoreUpdate(): Promise<boolean> {
    const { CapacitorUpdater, AppUpdateAvailability } = await import('@capgo/capacitor-updater')
    if (!isIOSNative()) {
        // Play knows this account's testing track, rollout and device eligibility.
        // Its version name field is actually a version CODE; never compare it
        // with the OTA release or native marketing version.
        const info = await CapacitorUpdater.getAppUpdateInfo()
        return (
            info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE &&
            typeof info.availableVersionCode === 'string' &&
            /^\d+$/.test(info.availableVersionCode) &&
            typeof info.currentVersionCode === 'string' &&
            /^\d+$/.test(info.currentVersionCode) &&
            Number(info.currentVersionCode) > 0 &&
            (compareVersions(info.availableVersionCode, info.currentVersionCode) ?? 0) > 0
        )
    }

    // The plugin defaults to the US storefront. That is not evidence that an
    // update exists for this Apple account. Missing bridge/country means no CTA.
    const country = await getStoreCountry()
    if (!country) return false
    const info = await CapacitorUpdater.getAppUpdateInfo({ country: country.countryCode })
    if (
        info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE ||
        (compareVersions(info.availableVersionName, info.currentVersionName) ?? 0) <= 0
    ) {
        return false
    }
    const { Device } = await import('@capacitor/device')
    const device = await Device.getInfo()
    const osComparison = compareVersions(device.osVersion, info.minimumOsVersion)
    return osComparison !== null && osComparison >= 0
}

/** Unknown/offline/old plugin responses must never send users to a store offering only Open. */
export async function isStoreUpdateAvailable(): Promise<boolean> {
    if (!isCapacitor()) return false
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            queryStoreUpdate(),
            new Promise<false>((resolve) => {
                timeout = setTimeout(() => resolve(false), STORE_UPDATE_TIMEOUT_MS)
            }),
        ])
    } catch {
        return false
    } finally {
        clearTimeout(timeout)
    }
}
