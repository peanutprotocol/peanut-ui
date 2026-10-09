'use client'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { type MigrationSurface } from '@/constants/migration.consts'

// Load the QR library only after a download CTA is clicked.
const ScanToDownloadModal = dynamic(() => import('@/components/Migration/ScanToDownloadModal'), { ssr: false })

type AppModalValue = (surface: MigrationSurface) => boolean

const AppModalContext = createContext<AppModalValue>(() => false)

/** The returned handler reports whether the store or QR modal handled the click; false leaves navigation to the caller. */
export function useAppModal(): AppModalValue {
    return useContext(AppModalContext)
}

export function AppModalProvider({ children }: { children: ReactNode }) {
    const migrationOn = useMigrationFlag()
    const [surface, setSurface] = useState<MigrationSurface | null>(null)

    const interceptAppCta = useCallback<AppModalValue>(
        (nextSurface) => {
            if (!migrationOn || isCapacitor()) return false
            // phones too: the modal holds "Log in on web instead", the landing
            // page's only login entry while signup is app-only
            setSurface(nextSurface)
            return true
        },
        [migrationOn]
    )

    return (
        <AppModalContext.Provider value={interceptAppCta}>
            {children}
            {surface && <ScanToDownloadModal visible onClose={() => setSurface(null)} surface={surface} showLogIn />}
        </AppModalContext.Provider>
    )
}
