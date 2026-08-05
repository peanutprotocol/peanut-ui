// capgo ota update management.
// only imported when isCapacitor() is true — uses dynamic import in the hook.

import type { BundleInfo } from '@capgo/capacitor-updater'
import { isDemoMode } from '@/utils/demo'

export interface OtaUpdateState {
    updateAvailable: boolean
    downloadProgress: number
    bundleInfo: BundleInfo | null
    error: string | null
}

// initialize capgo updater: call notifyAppReady(), set up listeners, and run a
// single update check for this launch. autoUpdate is disabled in the native
// config, so the check happens here exactly once per app start (instead of the
// plugin polling on every foreground, which tripped Capgo's cloud rate limit).
// returns a cleanup function to remove all listeners.
export async function initCapgoUpdater(
    onUpdateAvailable?: (bundle: BundleInfo) => void,
    onDownloadProgress?: (percent: number) => void,
    onUpdateFailed?: (error: string) => void
): Promise<() => void> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')

    // critical: must be called every app launch within appReadyTimeout (15s),
    // even in demo mode — otherwise capgo auto-rolls back a previously-set bundle.
    await CapacitorUpdater.notifyAppReady()

    const listeners: Array<{ remove: () => void }> = []

    listeners.push(
        await CapacitorUpdater.addListener('download', (res: { percent: number }) => {
            onDownloadProgress?.(res.percent)
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

    // Demo sessions are the app-store review sandbox — no OTA, and skipping the
    // check keeps the reviewer's device from adding to the Capgo rate limit.
    if (!isDemoMode()) {
        try {
            const latest = await CapacitorUpdater.getLatest()
            // getLatest resolves with a url only when a genuinely newer bundle exists.
            if (latest.url && latest.version) {
                const bundle = await CapacitorUpdater.download({
                    url: latest.url,
                    version: latest.version,
                    checksum: latest.checksum,
                    sessionKey: latest.sessionKey,
                    manifest: latest.manifest,
                })
                onUpdateAvailable?.(bundle)
                // apply on next launch (no mid-session reload — avoids yanking the
                // UI out from under the user).
                await CapacitorUpdater.set({ id: bundle.id })
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err ?? '')
            // "No new version available" is the normal up-to-date path, not a failure.
            if (message !== 'No new version available') {
                console.error('[capgo] update check failed:', message)
                onUpdateFailed?.(message)
            }
        }
    }

    return () => listeners.forEach((l) => l.remove())
}
