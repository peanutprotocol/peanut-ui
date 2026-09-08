'use client'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { openStore } from '@/utils/migration.utils'
import { type MigrationSurface } from '@/constants/migration.consts'

// Load the QR library only after a desktop CTA is clicked.
const ScanToDownloadModal = dynamic(() => import('@/components/Migration/ScanToDownloadModal'), { ssr: false })

type AppModalValue = (surface: MigrationSurface) => boolean

const AppModalContext = createContext<AppModalValue>(() => false)

/** The returned handler reports whether the store or QR modal handled the click; false leaves navigation to the caller. */
export function useAppModal(): AppModalValue {
    return useContext(AppModalContext)
}

export function AppModalProvider({ children }: { children: ReactNode }) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [surface, setSurface] = useState<MigrationSurface | null>(null)

    const interceptAppCta = useCallback<AppModalValue>(
        (nextSurface) => {
            if (!migrationOn || isCapacitor()) return false
            if (deviceType === DeviceType.WEB) {
                setSurface(nextSurface)
                return true
            }
            openStore(deviceType === DeviceType.ANDROID ? 'android' : 'ios', nextSurface)
            return true
        },
        [migrationOn, deviceType]
    )

    return (
        <AppModalContext.Provider value={interceptAppCta}>
            {children}
            {surface && <ScanToDownloadModal visible onClose={() => setSurface(null)} surface={surface} />}
        </AppModalContext.Provider>
    )
}
