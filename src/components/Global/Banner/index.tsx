'use client'

import { usePathname } from 'next/navigation'
import { MaintenanceBanner } from './MaintenanceBanner'
import { MarqueeWrapper } from '../MarqueeWrapper'
import maintenanceConfig from '@/config/underMaintenance.config'
import { HandThumbsUp } from '@/assets'
import Image from 'next/image'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { GIT_COMMIT_HASH, IS_PRODUCTION } from '@/constants/general.consts'

export function Banner() {
    const pathname = usePathname()
    if (!pathname) return null

    // check if maintenance banner OR full maintenance is enabled - show on all pages
    if (maintenanceConfig.enableMaintenanceBanner || maintenanceConfig.enableFullMaintenance) {
        return <MaintenanceBanner />
    }

    // don't show beta feedback banner on landing page, setup page, or quests pages
    if (pathname === '/' || pathname === '/setup' || pathname.startsWith('/quests')) return null

    // show beta feedback banner when not in maintenance
    return <FeedbackBanner />
}

function FeedbackBanner() {
    const { setIsSupportModalOpen } = useSupportModalContext()

    const handleClick = () => {
        setIsSupportModalOpen(true)
    }

    return (
        <button onClick={handleClick} className="w-full cursor-pointer">
            <MarqueeWrapper backgroundColor="bg-primary-1" direction="left">
                <span className="z-10 mx-4 flex items-center gap-2 text-sm font-semibold">
                    Peanut is in beta! Thank you for being an early user, share your feedback here
                    <Image src={HandThumbsUp} alt="Thumbs up" className="h-4 w-4" />
                    {!IS_PRODUCTION && <span className="ml-2 text-sm font-semibold">version: {GIT_COMMIT_HASH}</span>}
                </span>
            </MarqueeWrapper>
        </button>
    )
}

export { GenericBanner } from './GenericBanner'
export { MaintenanceBanner } from './MaintenanceBanner'
