'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MaintenanceBanner } from './MaintenanceBanner'
import { MarqueeWrapper } from '../MarqueeWrapper'
import maintenanceConfig from '@/config/underMaintenance.config'
import { HandThumbsUp } from '@/assets'
import Image from 'next/image'
import { useModalsContext } from '@/context/ModalsContext'
import { GIT_COMMIT_HASH, IS_PRODUCTION } from '@/constants/general.consts'
import { getRunMode, isRealMoneyMode, logRunMode } from '@/utils/mode'

export function Banner() {
    const pathname = usePathname()
    if (!pathname) return null

    // check if maintenance banner OR full maintenance is enabled - show on all pages
    if (maintenanceConfig.enableMaintenanceBanner || maintenanceConfig.enableFullMaintenance) {
        return <MaintenanceBanner />
    }

    // don't show beta feedback banner on landing pages, setup page, or quests pages
    if (pathname === '/' || pathname === '/setup' || pathname.startsWith('/quests') || pathname.startsWith('/lp'))
        return null

    // show beta feedback banner when not in maintenance
    return <FeedbackBanner />
}

function FeedbackBanner() {
    const { setIsSupportModalOpen } = useModalsContext()

    // Log run-mode once on mount (dev only). Big yellow banner in the
    // browser console so you can never confuse sandbox for staging at a
    // glance. Real-money modes get a red banner instead.
    useEffect(() => {
        if (IS_PRODUCTION) return
        logRunMode()
    }, [])

    const handleClick = () => {
        setIsSupportModalOpen(true)
    }

    const mode = !IS_PRODUCTION ? getRunMode() : null
    const realMoney = !IS_PRODUCTION && isRealMoneyMode()

    return (
        <button onClick={handleClick} className="w-full cursor-pointer">
            <MarqueeWrapper backgroundColor="bg-primary-1" direction="left">
                <span className="z-10 mx-4 flex items-center gap-2 text-sm font-semibold">
                    Peanut is in beta! Thank you for being an early user, share your feedback here
                    <Image src={HandThumbsUp} alt="Thumbs up" className="h-4 w-4" />
                    {!IS_PRODUCTION && <span className="ml-2 text-sm font-semibold">version: {GIT_COMMIT_HASH}</span>}
                    {mode && (
                        // High-contrast yellow-on-black pill. Visually impossible
                        // to miss; the goal is "you can never accidentally think
                        // you're in sandbox when you're hitting prod." Real-money
                        // modes get a flashing red emoji prefix.
                        <span
                            className={
                                'ml-2 rounded-sm border border-black px-2 py-0.5 text-xs font-extrabold ' +
                                (realMoney ? 'bg-red-500 text-white' : 'bg-yellow-300 text-black')
                            }
                        >
                            {realMoney ? '⚠ REAL MONEY · ' : '⚙ '}
                            {mode.preset.toUpperCase()}
                        </span>
                    )}
                </span>
            </MarqueeWrapper>
        </button>
    )
}
