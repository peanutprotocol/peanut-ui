'use client'

import { AppShell } from '@/components/Global/AppShell'
import { BottomNav } from '@/components/Global/BottomNav'
import GuestLoginModal from '@/components/Global/GuestLoginModal'
import QRScannerOverlay from '@/components/Global/QRScannerOverlay'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { useUserStore } from '@/redux/hooks'
import { Banner } from '@/components/Global/Banner'
import { twMerge } from 'tailwind-merge'

export default function PaymentLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useUserStore()
    const isUserLoggedIn = !!user?.user.userId || false

    return (
        <AppShell
            variant="app"
            banner={<Banner />}
            nav={isUserLoggedIn && <BottomNav />}
            contentClassName={
                isUserLoggedIn
                    ? 'pb-[calc(6rem_+_env(safe-area-inset-bottom))]'
                    : 'pb-[calc(1rem_+_env(safe-area-inset-bottom))]'
            }
            innerClassName={twMerge(
                isUserLoggedIn ? 'min-h-[calc(100dvh_-_160px)]' : 'min-h-[calc(100dvh_-_64px)]'
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
