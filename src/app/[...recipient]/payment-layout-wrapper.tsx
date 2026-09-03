'use client'

import { AppShell } from '@/components/Global/AppShell'
import { BottomNav } from '@/components/Global/BottomNav'
import GuestLoginModal from '@/components/Global/GuestLoginModal'
import QRScannerOverlay from '@/components/Global/QRScannerOverlay'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { useAuth } from '@/context/authContext'
import { Banner } from '@/components/Global/Banner'
import { twMerge } from '@/utils/tw'

export default function PaymentLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    const isUserLoggedIn = !!user?.user.userId || false

    return (
        <AppShell
            variant="app"
            banner={<Banner />}
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
    )
}
