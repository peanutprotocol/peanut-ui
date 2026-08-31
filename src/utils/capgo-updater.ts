// capgo ota update management.
// only imported when isCapacitor() is true — uses dynamic import in the hook.

import type { BundleInfo } from '@capgo/capacitor-updater'
import { isDemoMode } from '@/utils/demo'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

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
    let updateCheckTimer: ReturnType<typeof setTimeout> | undefined
    if (!isDemoMode()) {
        updateCheckTimer = setTimeout(
            () => void checkAndStageUpdate(onUpdateAvailable, onUpdateFailed),
            UPDATE_CHECK_DELAY_MS
        )
    }

    return () => {
        clearTimeout(updateCheckTimer)
        listeners.forEach((l) => l.remove())
    }
}

const UPDATE_CHECK_DELAY_MS = 5_000

// What one update check actually achieved. The launch path ignores it; the beta
// opt-in needs it, because "channel switched" and "beta bundle waiting" are not
// the same thing and a tester told to restart for nothing chases a ghost.
export type OtaCheckOutcome = 'staged' | 'up-to-date' | 'failed'

async function checkAndStageUpdate(
    onUpdateAvailable?: (bundle: BundleInfo) => void,
    onUpdateFailed?: (error: string) => void
): Promise<OtaCheckOutcome> {
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
            // UI out from under the user). set() reloads IMMEDIATELY; next()
            // is the deferred variant.
            await CapacitorUpdater.next({ id: bundle.id })
            removeStoredValue(FAILURE_STREAK_KEY)
            return 'staged'
        }
        removeStoredValue(FAILURE_STREAK_KEY)
        return 'up-to-date'
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err ?? '')
        // "No new version available" is the normal up-to-date path, not a failure.
        if (message === 'No new version available') {
            removeStoredValue(FAILURE_STREAK_KEY)
            return 'up-to-date'
        }
        // captureConsoleIntegration turns console.error into a Sentry event, and
        // this updater runs on every launch — transient CDN/network failures that
        // simply retry next launch were worth ~95 events/day. Only failures that
        // mean OTA is actually dead for this build get error level immediately;
        // anything else escalates once the same failure repeats launch after
        // launch, so a persistent unknown outage still reaches Sentry.
        const streak = recordFailureStreak(message)
        if (OTA_BROKEN_ERRORS.some((pattern) => message.includes(pattern))) {
            console.error('[capgo] update check failed:', message)
        } else if (streak >= PERSISTENT_FAILURE_THRESHOLD) {
            console.error(`[capgo] update check failed on ${streak} consecutive launches:`, message)
        } else {
            console.info('[capgo] update check failed:', message)
        }
        onUpdateFailed?.(message)
        return 'failed'
    }
}

// disable_auto_update_under_native: the served bundle semver-sorts below the
// installed binary, so every device refuses it. Checksum mismatch: the bundle
// arrived corrupt. Neither retries its way out.
const OTA_BROKEN_ERRORS = ['disable_auto_update_under_native', 'Checksum mismatch']

const FAILURE_STREAK_KEY = 'capgoUpdateFailureStreak'
const PERSISTENT_FAILURE_THRESHOLD = 3

function recordFailureStreak(message: string): number {
    let count = 1
    try {
        const previous = JSON.parse(readStoredValue(FAILURE_STREAK_KEY) ?? '')
        if (previous?.message === message && typeof previous.count === 'number') count = previous.count + 1
    } catch {
        // no stored streak, or an unreadable one — start over at 1
    }
    writeStoredValue(FAILURE_STREAK_KEY, JSON.stringify({ message, count }))
    return count
}

// The channel every merge to `dev` publishes to (capgo-deploy.yml). Testers opt
// in from the About screen; every other install stays on the app's default
// channel (production) and never sees these bundles.
export const BETA_OTA_CHANNEL = 'staging'

export interface OtaChannelStatus {
    channel: string | null
    bundleVersion: string | null
    deviceId: string | null
}

// Capgo rejects setChannel() unless the channel allows self-assignment. That is
// a standing configuration fact the tester can act on ("ask an admin"), unlike a
// timeout — so it must not swallow every other rejection, or a flaky network
// sends people chasing a dashboard toggle that is already correct.
export class OtaChannelClosedError extends Error {}

const CLOSED_CHANNEL_CODES = ['channel_private', 'disabled_by_config', 'channel_not_found', 'cannot_set_channel']

// The plugin reports the reason as a CapacitorException `data.error` code on iOS
// and folds it into the message on Android; check both.
function isClosedChannel(reason: unknown): boolean {
    const code = (reason as { data?: { error?: unknown } } | null)?.data?.error
    const message = reason instanceof Error ? reason.message : String(reason ?? '')
    return CLOSED_CHANNEL_CODES.some((closed) => code === closed || message.includes(closed))
}

export async function readOtaChannelStatus(): Promise<OtaChannelStatus> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const [channel, current, device] = await Promise.all([
        CapacitorUpdater.getChannel().catch(() => null),
        CapacitorUpdater.current().catch(() => null),
        CapacitorUpdater.getDeviceId().catch(() => null),
    ])
    return {
        channel: channel?.channel ?? null,
        bundleVersion: current?.bundle?.version ?? null,
        deviceId: device?.deviceId ?? null,
    }
}

// Join the beta channel and pull its bundle straight away. The bundle applies on
// the next launch, like every other OTA — next() rather than set(). The returned
// outcome is what the switch reports: a device whose binary already outranks the
// beta bundle joins the channel and downloads nothing.
export async function joinBetaOtaChannel(): Promise<OtaCheckOutcome> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    let result
    try {
        result = await CapacitorUpdater.setChannel({ channel: BETA_OTA_CHANNEL })
    } catch (err) {
        if (isClosedChannel(err)) throw new OtaChannelClosedError(err instanceof Error ? err.message : String(err))
        throw err
    }
    if (result.error) {
        if (isClosedChannel(result.error)) throw new OtaChannelClosedError(result.error)
        throw new Error(result.error)
    }
    return checkAndStageUpdate()
}

// Beta bundles carry a higher version than production's, so no production OTA
// can ever overwrite one: reset() back to the store bundle is the only way out,
// and it reloads the app on the spot.
export async function leaveBetaOtaChannel(): Promise<void> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.unsetChannel({})
    await CapacitorUpdater.reset()
}
