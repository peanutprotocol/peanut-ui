'use client'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { openStore, storeForDevice } from '@/utils/migration.utils'
import { type MigrationSurface } from '@/constants/migration.consts'
import type { MarketingQrContext } from '@/features/marketing-qr/contract'

// Load the QR library only after a desktop CTA is clicked.
const ScanToDownloadModal = dynamic(() => import('@/components/Migration/ScanToDownloadModal'), { ssr: false })

type AppModalValue = (surface: MigrationSurface, placement?: string) => boolean

const AppModalContext = createContext<AppModalValue>(() => false)

/** The returned handler reports whether the store or QR modal handled the click; false leaves navigation to the caller. */
export function useAppModal(): AppModalValue {
    return useContext(AppModalContext)
}

export function AppModalProvider({
    children,
    marketingPage,
    marketingLocale = 'en',
}: {
    children: ReactNode
    marketingPage?: MarketingQrContext['page']
    marketingLocale?: string
}) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const [pending, setPending] = useState<{
        surface: MigrationSurface
        marketingQr?: MarketingQrContext
    } | null>(null)

    const interceptAppCta = useCallback<AppModalValue>(
        (nextSurface, placement) => {
            if (!migrationOn || isCapacitor()) return false
            const store = storeForDevice(deviceType)
            if (!store) {
                setPending({
                    surface: nextSurface,
                    ...(marketingPage && placement
                        ? { marketingQr: { page: marketingPage, placement, locale: marketingLocale } }
                        : {}),
                })
                return true
            }
            openStore(store, nextSurface)
            return true
        },
        [migrationOn, deviceType, marketingPage, marketingLocale]
    )

    return (
        <AppModalContext.Provider value={interceptAppCta}>
            {children}
            {pending && (
                <ScanToDownloadModal
                    visible
                    onClose={() => setPending(null)}
                    surface={pending.surface}
                    marketingQr={pending.marketingQr}
                    showLogIn
                />
            )}
        </AppModalContext.Provider>
    )
}
