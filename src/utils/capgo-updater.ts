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
    // The check itself is deferred past first paint so its network round-trip
    // and bundle download don't contend with app startup (notifyAppReady above
    // stays immediate — it must land within appReadyTimeout).
    if (!isDemoMode()) {
        setTimeout(() => void checkAndStageUpdate(onUpdateAvailable, onUpdateFailed), UPDATE_CHECK_DELAY_MS)
    }

    return () => listeners.forEach((l) => l.remove())
}

const UPDATE_CHECK_DELAY_MS = 5_000

async function checkAndStageUpdate(
    onUpdateAvailable?: (bundle: BundleInfo) => void,
    onUpdateFailed?: (error: string) => void
): Promise<void> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
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
            // captureConsoleIntegration turns console.error into a Sentry event, and
            // this updater runs on every launch — transient CDN/network failures that
            // simply retry next launch were worth ~95 events/day. Only failures that
            // mean OTA is actually dead for this build get error level.
            const log = OTA_BROKEN_ERRORS.some((pattern) => message.includes(pattern)) ? console.error : console.info
            log('[capgo] update check failed:', message)
            onUpdateFailed?.(message)
        }
    }
}

// disable_auto_update_under_native: the served bundle semver-sorts below the
// installed binary, so every device refuses it. Checksum mismatch: the bundle
// arrived corrupt. Neither retries its way out.
const OTA_BROKEN_ERRORS = ['disable_auto_update_under_native', 'Checksum mismatch']
