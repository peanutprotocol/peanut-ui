'use client'
import React from 'react'
import { MarqueeWrapper } from '../MarqueeWrapper'

interface MigrationBannerProps {
    className?: string
}

export function MigrationBanner({ className = '' }: MigrationBannerProps) {
    return (
        // <div className={`relative w-full bg-yellow-1 text-black ${className}`}>
        <MarqueeWrapper backgroundColor="bg-yellow-1" direction="left">
            <div className="flex items-center justify-center py-4">
                <span className="text-h2 font-black uppercase tracking-wider">WE'VE MIGRATED TO PEANUT.ME</span>
            </div>
        </MarqueeWrapper>
        // </div>
    )
}
