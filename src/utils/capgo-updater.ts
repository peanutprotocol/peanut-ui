// capgo ota update management.
// only imported when isCapacitor() is true — uses dynamic import in the hook.

import type { BundleInfo } from '@capgo/capacitor-updater'

export interface OtaUpdateState {
    updateAvailable: boolean
    downloadProgress: number
    bundleInfo: BundleInfo | null
    error: string | null
}

// initialize capgo updater: call notifyAppReady() and set up listeners.
// returns a cleanup function to remove all listeners.
export async function initCapgoUpdater(
    onUpdateAvailable?: (bundle: BundleInfo) => void,
    onDownloadProgress?: (percent: number) => void,
    onUpdateFailed?: (error: string) => void
): Promise<() => void> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')

    // critical: must be called every app launch within appReadyTimeout (15s).
    // if not called, capgo auto-rolls back to previous bundle.
    await CapacitorUpdater.notifyAppReady()

    const listeners: Array<{ remove: () => void }> = []

    listeners.push(
        await CapacitorUpdater.addListener('updateAvailable', (res: { bundle: BundleInfo }) => {
            console.log('[capgo] update available:', res.bundle.version)
            onUpdateAvailable?.(res.bundle)
        })
    )

    listeners.push(
        await CapacitorUpdater.addListener('download', (res: { percent: number }) => {
            onDownloadProgress?.(res.percent)
        })
    )

    listeners.push(
        await CapacitorUpdater.addListener('updateFailed', (res: { bundle: BundleInfo }) => {
            console.error('[capgo] update failed:', res.bundle.version)
            onUpdateFailed?.(`update to ${res.bundle.version} failed`)
        })
    )

    listeners.push(
        await CapacitorUpdater.addListener('downloadComplete', (res: { bundle: BundleInfo }) => {
            console.log('[capgo] download complete:', res.bundle.version)
        })
    )

    listeners.push(
        await CapacitorUpdater.addListener('appReloaded', () => {
            console.log('[capgo] app reloaded with new bundle')
        })
    )

    return () => listeners.forEach((l) => l.remove())
}
