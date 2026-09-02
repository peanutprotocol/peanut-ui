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
            () => void queueUpdateCheck(onUpdateAvailable, onUpdateFailed),
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

// One OTA operation at a time, whoever asks. The launch check can still be
// downloading when a tester flips the beta switch, and an unserialized check
// calls next() with a bundle chosen for the channel the device is leaving —
// which is how a device ends up booting beta code with the channel already
// unset, the one state no production OTA can repair.
//
// Queueing rather than sharing the in-flight promise matters: the join needs a
// check made AFTER its setChannel, not the launch check's verdict on the old
// channel.
let pendingOtaWork: Promise<void> = Promise.resolve()

function queueOtaWork<T>(task: () => Promise<T>): Promise<T> {
    const result = pendingOtaWork.then(task, task)
    pendingOtaWork = result.then(
        () => undefined,
        () => undefined
    )
    return result
}

function queueUpdateCheck(
    onUpdateAvailable?: (bundle: BundleInfo) => void,
    onUpdateFailed?: (error: string) => void
): Promise<OtaCheckOutcome> {
    return queueOtaWork(() => checkAndStageUpdate(onUpdateAvailable, onUpdateFailed))
}

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
        if (isUpToDateRejection(message)) {
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

// The normal up-to-date path, not a failure. Plugin 8.45+ rejects getLatest()
// with the server's error code; older builds used the sentence the docs list.
function isUpToDateRejection(message: string): boolean {
    return message === 'No new version available' || message.includes('no_new_version_available')
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

// The app's default channel (ios-release.yml / android-release.yml / release-ota.yml).
// Leaving beta assigns the device here explicitly, so the channel must allow
// device self-assign in the Capgo dashboard.
export const PRODUCTION_OTA_CHANNEL = 'production'

export interface OtaChannelStatus {
    channel: string | null
    bundleVersion: string | null
    deviceId: string | null
    // The exit is only finished when the store bundle is the one running: the
    // channel alone cannot say so, and a half-finished exit leaves a device on
    // beta code with a default channel.
    onBuiltinBundle: boolean
}

// A leave that started but was never confirmed. Written before the channel is
// cleared, because after that the device looks like it is on the default channel
// while it still runs the beta bundle — invisible, and unreachable by any
// production OTA. The value is the beta bundle that was running, so a later
// launch can tell "still on it" from "replaced by the store bundle or any
// production OTA" — a bare flag could only recognise the builtin bundle, and
// the JS reading it after the reset may be a shell that has never seen the key.
const PENDING_EXIT_KEY = 'capgoPendingBetaExit'
export const UNKNOWN_BETA_EXIT_BUNDLE = '1'

export function pendingBetaExitBundle(): string | null {
    return readStoredValue(PENDING_EXIT_KEY)
}

export function hasPendingBetaExit(): boolean {
    return pendingBetaExitBundle() !== null
}

export function clearPendingBetaExit(): void {
    removeStoredValue(PENDING_EXIT_KEY)
}

// Capgo rejects setChannel() unless the channel allows self-assignment. That is
// a standing configuration fact the tester can act on ("ask an admin"), unlike a
// timeout — so it must not swallow every other rejection, or a flaky network
// sends people chasing a dashboard toggle that is already correct.
export class OtaChannelClosedError extends Error {}

// Both platforms reject setChannel() with a CapacitorException carrying
// `data.error`: iOS normalises the private-channel case to `channel_private`,
// Android passes the backend's own code straight through. `disabled_by_config`
// (allowSetDefaultChannel off) and `channel_not_found` arrive in the message.
const CLOSED_CHANNEL_CODES = [
    'channel_private',
    'cannot_update_via_private_channel',
    'channel_self_set_not_allowed',
    'disabled_by_config',
    'channel_not_found',
]

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
        onBuiltinBundle: current?.bundle?.id === 'builtin',
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
    return queueUpdateCheck()
}

// A device that unset its channel but kept the beta bundle is the worst state of
// the two: production versions sort below it, so nothing will ever replace it.
export class OtaResetFailedError extends Error {}

// A device Capgo still routes to the beta channel after the leave: the server
// refused the production self-assign, or someone forced the device onto beta
// from the dashboard and the assignment outlived the app's attempt to rewrite it.
export class OtaChannelOverrideError extends Error {}

// Capgo could not say which channel it will serve. Resetting on that guess is how
// a forced tester gets reloaded onto the store bundle and quietly routed back to
// beta on the next check, with the reload having eaten the explanation.
export class OtaChannelUnknownError extends Error {}

// Beta bundles carry a higher version than production's, so no production OTA
// can ever overwrite one: reset() back to the store bundle is the only way out,
// and it reloads the app on the spot. reset() resolving is therefore the unusual
// path (the device was already on the builtin bundle) — a rejection means the
// channel is gone but the beta code is still running, so retry once and say so
// rather than reporting a clean exit.
//
// Queued with the checks: a check still in flight would otherwise stage the beta
// bundle it had already chosen right after the reset cleared it.
export async function leaveBetaOtaChannel(): Promise<void> {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    return queueOtaWork(async () => {
        // Before the unset, not after: everything below can fail, and once the
        // channel is cleared nothing else records that an exit is owed.
        const running = await CapacitorUpdater.current().catch(() => null)
        writeStoredValue(PENDING_EXIT_KEY, running?.bundle?.version || UNKNOWN_BETA_EXIT_BUNDLE)
        try {
            await CapacitorUpdater.unsetChannel({})
        } catch (err) {
            clearPendingBetaExit()
            throw err
        }

        // unsetChannel() only drops the plugin's local preference (verified in
        // the plugin source: both platforms just remove a stored key). The
        // device→channel assignment lives on the server, and only setChannel()
        // rewrites it — so leave by assigning production, not by forgetting beta.
        let reassigned
        try {
            reassigned = await CapacitorUpdater.setChannel({
                channel: PRODUCTION_OTA_CHANNEL,
                triggerAutoUpdate: false,
            })
        } catch (err) {
            throw new OtaChannelOverrideError(err instanceof Error ? err.message : String(err ?? ''))
        }
        if (reassigned.error) throw new OtaChannelOverrideError(reassigned.error)

        // getChannel() asks the backend what it will actually serve, and only a
        // successful, channel-bearing answer licenses the reset. Offline, rate
        // limited, or an error field means indeterminate — not "clear".
        const effective = await CapacitorUpdater.getChannel().catch(() => null)
        if (!effective || effective.error) {
            throw new OtaChannelUnknownError(effective?.error ?? 'the effective channel could not be read')
        }
        if (effective.channel === BETA_OTA_CHANNEL) {
            throw new OtaChannelOverrideError(`${BETA_OTA_CHANNEL} is still assigned to this device`)
        }

        try {
            await CapacitorUpdater.reset()
            // Usually unreachable — reset() reloads the app. The next launch
            // clears the marker instead, once the builtin bundle is running.
            clearPendingBetaExit()
        } catch {
            try {
                await CapacitorUpdater.reset()
                clearPendingBetaExit()
            } catch (err) {
                throw new OtaResetFailedError(err instanceof Error ? err.message : String(err ?? ''))
            }
        }
    })
}
