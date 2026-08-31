'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNativeBridge } from '@/utils/capacitor'
import {
    BETA_OTA_CHANNEL,
    OtaChannelClosedError,
    OtaResetFailedError,
    type OtaChannelStatus,
} from '@/utils/capgo-updater'

/**
 * - `staged`: on the channel, beta bundle downloaded, waiting for a restart
 * - `joined`: on the channel with nothing newer to download
 * - `join-no-bundle`: on the channel, but the bundle could not be fetched — the
 *   `disable_auto_update_under_native` case after a native release lands here
 * - `left`: back on the default channel and the store bundle
 * - `left-still-beta`: channel unset, but the beta bundle is still running and
 *   no production OTA can replace it — the app has to be reinstalled
 * - `closed`: the channel does not accept self-assignment
 * - `failed`: the switch itself failed (offline, rate limited, misconfigured)
 */
export type OtaChannelSwitchResult =
    | 'staged'
    | 'joined'
    | 'join-no-bundle'
    | 'left'
    | 'left-still-beta'
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

    const refresh = useCallback(async () => {
        const { readOtaChannelStatus } = await import('@/utils/capgo-updater')
        setStatus(await readOtaChannelStatus())
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
                    // Reloads the app onto the store bundle: nothing after this runs.
                    await leaveBetaOtaChannel()
                    return 'left'
                }
                const outcome = await joinBetaOtaChannel()
                await refresh()
                if (outcome === 'staged') return 'staged'
                return outcome === 'up-to-date' ? 'joined' : 'join-no-bundle'
            } catch (err) {
                console.warn('[capgo] channel switch failed:', err)
                if (err instanceof OtaResetFailedError) return 'left-still-beta'
                return err instanceof OtaChannelClosedError ? 'closed' : 'failed'
            } finally {
                setBusy(false)
            }
        },
        [refresh]
    )

    return { supported, status, isBeta: status?.channel === BETA_OTA_CHANNEL, busy, setBeta }
}
