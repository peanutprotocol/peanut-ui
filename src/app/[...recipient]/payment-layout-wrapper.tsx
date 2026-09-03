'use client'

import { AppShell } from '@/components/Global/AppShell'
import { BottomNav } from '@/components/Global/BottomNav'
import GuestLoginModal from '@/components/Global/GuestLoginModal'
import QRScannerOverlay from '@/components/Global/QRScannerOverlay'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { NavHeaderPresenceProvider } from '@/components/Global/Banner/navHeaderPresence'
import { ShellBannerFallback } from '@/components/Global/Banner/ShellBannerFallback'
import { useUserStore } from '@/redux/hooks'
import { twMerge } from '@/utils/tw'

export default function PaymentLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useUserStore()
    const isUserLoggedIn = !!user?.user.userId || false

    return (
        <NavHeaderPresenceProvider>
            <AppShell
                variant="app"
                banner={<ShellBannerFallback />}
                nav={isUserLoggedIn && <BottomNav />}
                contentClassName={
                    isUserLoggedIn ? 'pb-[calc(6rem_+_var(--safe-bottom))]' : 'pb-[calc(1rem_+_var(--safe-bottom))]'
                }
                innerClassName={twMerge(
                    isUserLoggedIn
                        ? 'min-h-[calc(100dvh_-_160px_-_var(--safe-top)_-_var(--safe-bottom))]'
                        : 'min-h-[calc(100dvh_-_64px_-_var(--safe-top)_-_var(--safe-bottom))]'
                )}
                modals={
                    <>
                        <GuestLoginModal />
                        <SupportDrawer />
                        <QRScannerOverlay />
                    </>
                }
            >
                {children}
            </AppShell>
        </NavHeaderPresenceProvider>
    )
}
