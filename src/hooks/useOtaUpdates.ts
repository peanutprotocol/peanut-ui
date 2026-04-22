'use client'

import { useEffect, useState } from 'react'
import { isCapacitor } from '@/utils/capacitor'
import type { OtaUpdateState } from '@/utils/capgo-updater'

// initializes capgo ota updates on native builds.
// calls notifyAppReady() on mount — must fire on every app launch.
// no-op on web (isCapacitor guard).
export function useOtaUpdates() {
    const [state, setState] = useState<OtaUpdateState>({
        updateAvailable: false,
        downloadProgress: 0,
        bundleInfo: null,
        error: null,
    })

    useEffect(() => {
        if (!isCapacitor()) return

        let cleanup: (() => void) | undefined

        import('@/utils/capgo-updater')
            .then(({ initCapgoUpdater }) =>
                initCapgoUpdater(
                    (bundle) => setState((prev) => ({ ...prev, updateAvailable: true, bundleInfo: bundle })),
                    (percent) => setState((prev) => ({ ...prev, downloadProgress: percent })),
                    (error) => setState((prev) => ({ ...prev, error }))
                )
            )
            .then((fn) => {
                cleanup = fn
            })
            .catch((err) => {
                console.warn('[capgo] ota init failed:', err)
            })

        return () => {
            cleanup?.()
        }
    }, [])

    return state
}
