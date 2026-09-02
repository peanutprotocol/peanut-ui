'use client'

import type { BundleInfo } from '@capgo/capacitor-updater'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isAndroidNativeBridge, isCapacitor } from '@/utils/capacitor'
import type { OtaApplyOutcome } from '@/utils/capgo-updater'

/**
 * `manual-restart` — a reload was issued but the page outlived it (iOS, which
 * has no programmatic exit), so the user has to close the app themselves.
 * `failed` — nothing was handed to the plugin at all; the app is still on the
 * bundle it started with and the offer is retriable.
 */
export type OtaApplyState = 'idle' | 'applying' | 'manual-restart' | 'failed'

export interface OtaUpdateContextValue {
    /** downloaded bundle queued by the plugin, waiting for a restart */
    pendingBundle: BundleInfo | null
    /** the newest bundle targets a newer native binary — only the store can update */
    storeUpdateRequired: boolean
    applyState: OtaApplyState
    /** restart onto `pendingBundle` now (native only) */
    applyNow: () => Promise<void>
}

// set() and reload() both tear the page down; still being here this long after
// means neither did, and the app has to be closed by other means
const RELOAD_GRACE_MS = 3_000

const OtaUpdateContext = createContext<OtaUpdateContextValue>({
    pendingBundle: null,
    storeUpdateRequired: false,
    applyState: 'idle',
    applyNow: async () => {},
})

/**
 * Runs the Capgo updater on native launches (notifyAppReady + one staged
 * update check, see capgo-updater.ts) and exposes what it found, so the
 * profile can offer a restart instead of leaving the bundle to the next
 * cold start. No-op on web.
 */
export function OtaUpdateProvider({ children }: { children: React.ReactNode }) {
    const [pendingBundle, setPendingBundle] = useState<BundleInfo | null>(null)
    const [storeUpdateRequired, setStoreUpdateRequired] = useState(false)
    const [applyState, setApplyState] = useState<OtaApplyState>('idle')
    const fallbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    // Read and written synchronously: two taps landing in the same tick both see
    // `applyState === 'idle'` in their render's closure and would apply twice.
    const applyingRef = useRef(false)

    useEffect(() => {
        if (!isCapacitor()) return
        let disposed = false
        let cleanup: (() => void) | undefined

        // a bundle staged on an earlier launch is still queued in the plugin
        import('@capgo/capacitor-updater')
            .then(({ CapacitorUpdater }) => CapacitorUpdater.getNextBundle())
            .then((bundle) => {
                if (!disposed && bundle) setPendingBundle((current) => current ?? bundle)
            })
            .catch((err) => console.warn('[capgo] next bundle read failed:', err))

        import('@/utils/capgo-updater')
            .then(({ initCapgoUpdater }) =>
                initCapgoUpdater({
                    onUpdateAvailable: (bundle) => setPendingBundle(bundle),
                    onStoreUpdateRequired: () => setStoreUpdateRequired(true),
                })
            )
            .then((fn) => {
                // Unmounted while init was still resolving: run the cleanup now
                // or the listeners it registered are never removed.
                if (disposed) fn()
                else cleanup = fn
            })
            .catch((err) => console.warn('[capgo] ota init failed:', err))

        return () => {
            disposed = true
            cleanup?.()
            clearTimeout(fallbackTimer.current)
        }
    }, [])

    const applyNow = useCallback(async () => {
        // A failed apply is retriable; 'applying' and 'manual-restart' are not
        // (one is in flight, the other already handed the page to the plugin).
        if (!pendingBundle || applyingRef.current || applyState === 'manual-restart') return
        applyingRef.current = true
        setApplyState('applying')
        const armWatchdog = () => {
            clearTimeout(fallbackTimer.current)
            fallbackTimer.current = setTimeout(() => {
                if (!isAndroidNativeBridge()) {
                    setApplyState('manual-restart')
                    return
                }
                // exitApp (or its chunk) failing would otherwise strand the modal in
                // 'applying': no close button, no enabled CTA, no way out. Fall back
                // to the instruction iOS already gets.
                import('@capacitor/app')
                    .then(({ App }) => App.exitApp())
                    .catch((err) => {
                        console.warn('[capgo] exitApp failed:', err)
                        setApplyState('manual-restart')
                    })
            }, RELOAD_GRACE_MS)
        }
        // Armed before set(): a set() that neither reloads nor rejects would
        // otherwise leave the promise pending and the fallback never scheduled.
        // A rejected set() hands over to a re-download, which must not be cut
        // short — the watchdog is dropped for its duration and re-armed once
        // reload() has been issued.
        armWatchdog()
        let outcome: OtaApplyOutcome = 'failed'
        try {
            const { applyStagedBundle } = await import('@/utils/capgo-updater')
            outcome = await applyStagedBundle(pendingBundle.id, {
                onSetRejected: () => clearTimeout(fallbackTimer.current),
                onRestaged: (bundle) => setPendingBundle(bundle),
            })
        } catch (err) {
            console.warn('[capgo] apply failed:', err)
        }
        // Nothing reached the plugin: no restart is coming, so the watchdog must
        // not fire — it would exit the app on Android, or tell an iOS user to
        // close and reopen for an update that was never staged — and the modal
        // has to become actionable again instead of spinning on 'applying'.
        if (outcome !== 'reloading') {
            clearTimeout(fallbackTimer.current)
            applyingRef.current = false
            setApplyState('failed')
            return
        }
        armWatchdog()
    }, [pendingBundle, applyState])

    const value = useMemo(
        () => ({ pendingBundle, storeUpdateRequired, applyState, applyNow }),
        [pendingBundle, storeUpdateRequired, applyState, applyNow]
    )

    return <OtaUpdateContext.Provider value={value}>{children}</OtaUpdateContext.Provider>
}

export const useOtaUpdate = () => useContext(OtaUpdateContext)
