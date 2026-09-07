'use client'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import ScanToDownloadModal from '@/components/Migration/ScanToDownloadModal'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { openStore, type StoreHandoff } from '@/utils/migration.utils'
import { type MigrationSurface } from '@/constants/migration.consts'

/**
 * One scan-to-download modal for the whole landing page, hoisted above the
 * server-rendered folds so every re-pointed CTA — the rates widget, the
 * countries illustration, the get-the-app fold — opens the same instance and
 * only has to say which surface it is calling from.
 *
 * `interceptAppCta` is the whole contract: call it first in a CTA handler and
 * bail when it returns true. Desktop opens the modal, phones bounce straight to
 * their store carrying the hand-off, and with the flag off (or inside the
 * native app) it returns false and the CTA does whatever it did before.
 */
type AppModalValue = (surface: MigrationSurface, handoff?: StoreHandoff) => boolean

const AppModalContext = createContext<AppModalValue>(() => false)

/** Safe outside a provider: the fold keeps its flag-off behaviour. */
export function useAppModal(): AppModalValue {
    return useContext(AppModalContext)
}

export function AppModalProvider({ children }: { children: ReactNode }) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    // surface AND hand-off together: the desktop modal's QR has to encode where
    // the scanning phone should land, so dropping the hand-off here would make
    // `dest` a phone-only feature.
    const [pending, setPending] = useState<{ surface: MigrationSurface; handoff?: StoreHandoff } | null>(null)

    const interceptAppCta = useCallback<AppModalValue>(
        (nextSurface, handoff) => {
            if (!migrationOn || isCapacitor()) return false
            if (deviceType === DeviceType.WEB) {
                setPending({ surface: nextSurface, handoff })
                return true
            }
            openStore(deviceType === DeviceType.ANDROID ? 'android' : 'ios', nextSurface, handoff)
            return true
        },
        [migrationOn, deviceType]
    )

    // the identity is what every fold's click handler closes over
    const value = useMemo(() => interceptAppCta, [interceptAppCta])

    return (
        <AppModalContext.Provider value={value}>
            {children}
            {pending && (
                <ScanToDownloadModal
                    visible
                    onClose={() => setPending(null)}
                    surface={pending.surface}
                    handoff={pending.handoff}
                />
            )}
        </AppModalContext.Provider>
    )
}
