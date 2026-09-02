'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNativeBridge } from '@/utils/capacitor'
import {
    BETA_OTA_CHANNEL,
    clearPendingBetaExit,
    OtaChannelClosedError,
    OtaChannelOverrideError,
    OtaChannelUnknownError,
    OtaResetFailedError,
    pendingBetaExitBundle,
    UNKNOWN_BETA_EXIT_BUNDLE,
    type OtaChannelStatus,
} from '@/utils/capgo-updater'

// An owed exit is over once the beta bundle recorded at the leave is no longer
// the one running — the store bundle or any production OTA counts. A legacy
// marker that never recorded a bundle can only be settled by the builtin bundle.
function betaExitFinished(status: OtaChannelStatus, recordedBundle: string): boolean {
    if (status.channel === BETA_OTA_CHANNEL) return false
    if (status.onBuiltinBundle) return true
    if (recordedBundle === UNKNOWN_BETA_EXIT_BUNDLE) return false
    return status.bundleVersion !== null && status.bundleVersion !== recordedBundle
}

/**
 * - `staged`: on the channel, beta bundle downloaded, waiting for a restart
 * - `joined`: on the channel with nothing newer to download
 * - `join-no-bundle`: on the channel, but the bundle could not be fetched — the
 *   `disable_auto_update_under_native` case after a native release lands here
 * - `left`: back on the default channel. Usually unobservable — reset() reloads
 *   the app — but a device already on the store bundle stays put and needs the
 *   UI to catch up
 * - `left-still-beta`: channel unset, but the beta bundle is still running and
 *   no production OTA can replace it — the app has to be reinstalled
 * - `left-override`: Capgo still routes this device to beta — someone assigned
 *   it from the dashboard, and only the dashboard can take it back
 * - `left-unconfirmed`: Capgo could not be reached to confirm the exit, so the
 *   device is still on the beta bundle and the switch stays on, backed by a
 *   stored marker that survives a restart
 * - `closed`: the channel does not accept self-assignment
 * - `failed`: the switch itself failed (offline, rate limited, misconfigured)
 */
export type OtaChannelSwitchResult =
    | 'staged'
    | 'joined'
    | 'join-no-bundle'
    | 'left'
    | 'left-still-beta'
    | 'left-override'
    | 'left-unconfirmed'
    | 'closed'
    | 'failed'

export interface UseOtaChannel {
    supported: boolean
    status: OtaChannelStatus | null
    isBeta: boolean
    busy: boolean
    setBeta: (beta: boolean) => Promise<OtaChannelSwitchResult>
}

/**
 * Reads and switches the device's Capgo channel. Native-only: the plugin has no
 * web implementation worth calling, so `supported` stays false everywhere else
 * and the caller hides the control entirely.
 */
export function useOtaChannel(): UseOtaChannel {
    const [supported, setSupported] = useState(false)
    const [status, setStatus] = useState<OtaChannelStatus | null>(null)
    const [busy, setBusy] = useState(false)

    const [pendingExit, setPendingExit] = useState(false)

    const refresh = useCallback(async () => {
        const { readOtaChannelStatus } = await import('@/utils/capgo-updater')
        const next = await readOtaChannelStatus()
        setStatus(next)
        // Until the recorded beta bundle is gone the device is on beta code,
        // whatever the channel says.
        const recorded = pendingBetaExitBundle()
        const owed = recorded !== null && !betaExitFinished(next, recorded)
        if (recorded !== null && !owed) clearPendingBetaExit()
        setPendingExit(owed)
    }, [])

    // isNativeBridge() reads window, so it can only run after hydration.
    useEffect(() => {
        if (!isNativeBridge()) return
        setSupported(true)
        refresh().catch((err) => console.warn('[capgo] channel read failed:', err))
    }, [refresh])

    const setBeta = useCallback(
        async (beta: boolean): Promise<OtaChannelSwitchResult> => {
            setBusy(true)
            try {
                const { joinBetaOtaChannel, leaveBetaOtaChannel } = await import('@/utils/capgo-updater')
                if (!beta) {
                    // Normally reloads the app onto the store bundle and nothing
                    // after this runs — but a device already on that bundle just
                    // resolves, and then the stale channel would snap the switch
                    // back to on.
                    await leaveBetaOtaChannel()
                    await refresh()
                    return 'left'
                }
                const outcome = await joinBetaOtaChannel()
                // Best-effort: the join already happened, and a failed status
                // read must not report it as a failed switch.
                await refresh().catch(() => undefined)
                if (outcome === 'staged') return 'staged'
                return outcome === 'up-to-date' ? 'joined' : 'join-no-bundle'
            } catch (err) {
                console.warn('[capgo] channel switch failed:', err)
                if (err instanceof OtaChannelUnknownError) return 'left-unconfirmed'
                if (err instanceof OtaChannelOverrideError) return 'left-override'
                if (err instanceof OtaResetFailedError) return 'left-still-beta'
                return err instanceof OtaChannelClosedError ? 'closed' : 'failed'
            } finally {
                setBusy(false)
            }
        },
        [refresh]
    )

    // A pending exit counts as being on beta: the bundle is still the beta one,
    // and reading the channel alone would hide the card — and with it the only
    // way to finish leaving — from anyone outside the cohort.
    const isBeta = status?.channel === BETA_OTA_CHANNEL || pendingExit
    return { supported, status, isBeta, busy, setBeta }
}
