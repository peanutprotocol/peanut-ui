'use client'
import React from 'react'
import { MarqueeWrapper } from '../MarqueeWrapper'
import { PEANUTMAN_CHEERING } from '@/assets'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'

interface MigrationBannerProps {
    className?: string
}

export function MigrationBanner({ className = '' }: MigrationBannerProps) {
    return (
        <MarqueeWrapper backgroundColor="bg-yellow-1" direction="left">
            <div className={`mx-4 flex items-center py-4 ${className}`}>
                <img src={handThumbsUp.src} alt="Migration Icon" className="animation-thumbsUp mr-3 h-8 w-8" />
                <span className="text-h2 font-bold uppercase tracking-wider">WE'VE MIGRATED TO PEANUT.ME</span>
            </div>
        </MarqueeWrapper>
    )
}
