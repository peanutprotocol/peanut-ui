'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNativeBridge } from '@/utils/capacitor'
import { BETA_OTA_CHANNEL, OtaChannelClosedError, type OtaChannelStatus } from '@/utils/capgo-updater'

export type OtaChannelSwitchResult = 'ok' | 'closed' | 'failed'

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
                // leaveBetaOtaChannel() reloads the app, so nothing after it runs.
                if (beta) await joinBetaOtaChannel()
                else await leaveBetaOtaChannel()
                await refresh()
                return 'ok'
            } catch (err) {
                console.warn('[capgo] channel switch failed:', err)
                return err instanceof OtaChannelClosedError ? 'closed' : 'failed'
            } finally {
                setBusy(false)
            }
        },
        [refresh]
    )

    return { supported, status, isBeta: status?.channel === BETA_OTA_CHANNEL, busy, setBeta }
}
