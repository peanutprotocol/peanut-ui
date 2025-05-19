'use client'

import GuestLoginModal from '@/components/Global/GuestLoginModal'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import { ThemeProvider } from '@/config'

import classNames from 'classnames'
import { twMerge } from 'tailwind-merge'

export default function PaymentLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-[100dvh] w-full bg-background">
            {/* Wrapper div for desktop layout */}
            <div className="flex w-full">
                {/* Sidebar - Fixed on desktop */}
                <div className="hidden md:block">
                    <div className="fixed left-0 top-0 z-20 h-screen w-64">
                        <WalletNavigation />
                    </div>
                </div>

                {/* Main content area */}
                <div className="flex w-full flex-1 flex-col">
                    {/* Fixed top navbar */}
                    <div className="sticky top-0 z-10 w-full">
                        <TopNavbar />
                    </div>

                    {/* Scrollable content area */}
                    <div className={classNames(twMerge('flex-1 overflow-y-auto bg-background p-6 pb-24 md:pb-6'))}>
                        <ThemeProvider>
                            <div
                                className={twMerge(
                                    'flex h-full min-h-[calc(100dvh-160px)] w-full items-center justify-center md:ml-auto md:min-h-full md:w-[calc(100%-256px)]'
                                )}
                            >
                                {children}
                            </div>
                        </ThemeProvider>
                    </div>

                    {/* Mobile navigation */}

                    <div className="fixed bottom-0 left-0 right-0 z-10 bg-background md:hidden">
                        <WalletNavigation />
                    </div>
                </div>
            </div>

            {/* Modal */}
            <GuestLoginModal />
        </div>
    )
}
