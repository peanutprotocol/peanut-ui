'use client'

import Card from '@/components/Global/Card'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Tooltip } from '../Tooltip'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'
import { Icon } from '../Global/Icons/Icon'
import { getBadgeIcon, getPublicBadgeDescription } from './badge.utils'

type UIBadge = {
    code: string
    name: string
    description: string | null
    iconUrl: string | null
    earnedAt?: string | Date
}

interface BadgesRowProps {
    badges: UIBadge[]
    className?: string
    isSelfProfile?: boolean // determines if we show self-perspective or public-perspective copy
}

/**
 * A horizontally scrollable badge display component with navigation controls.
 * Displays user badges in a card with automatic responsive sizing and pagination.
 * - Responsive width calculation based on viewport
 * - Left/right navigation buttons for scrolling through badges
 * - Tooltips showing badge name and description on hover
 * - Automatic sorting by earned date (newest first)
 */
export function BadgesRow({ badges, className, isSelfProfile = true }: BadgesRowProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const [visibleCount, setVisibleCount] = useState<number>(4)
    const [startIdx, setStartIdx] = useState<number>(0)

    // sort by earnedAt, newest first
    const sortedBadges = useMemo(() => {
        return badges.sort((a, b) => {
            const at = a.earnedAt ? new Date(a.earnedAt).getTime() : 0
            const bt = b.earnedAt ? new Date(b.earnedAt).getTime() : 0
            return bt - at
        })
    }, [badges])

    // calculate how many badges can fit in the viewport
    // assumes each badge takes ~80px (64px icon + 16px gap)
    const calculateVisibleCount = useCallback(() => {
        const width = viewportRef.current?.clientWidth || 0
        const itemWidth = 80
        const count = Math.max(1, Math.floor(width / itemWidth))
        setVisibleCount(count)
        // clamp start index if viewport shrank
        setStartIdx((prev) => Math.max(0, Math.min(prev, Math.max(0, sortedBadges.length - count))))
    }, [sortedBadges.length])

    // setup resize observer for responsive width calculation
    useEffect(() => {
        calculateVisibleCount()
        window.addEventListener('resize', calculateVisibleCount)
        return () => window.removeEventListener('resize', calculateVisibleCount)
    }, [calculateVisibleCount])

    // reset scroll position when badge list changes
    useEffect(() => {
        setStartIdx(0)
    }, [sortedBadges.length])

    // navigate to the next page of badges
    const scrollRight = useCallback(() => {
        setStartIdx((v) => Math.min(v + 1, Math.max(0, sortedBadges.length - visibleCount)))
    }, [sortedBadges.length, visibleCount])

    // navigate to the previous page of badges
    const scrollLeft = useCallback(() => {
        setStartIdx((v) => Math.max(0, v - 1))
    }, [])

    // early return if no badges
    if (!sortedBadges.length) return null

    const endIdx = Math.min(startIdx + visibleCount, sortedBadges.length)
    const visibleBadges = sortedBadges.slice(startIdx, endIdx)
    const canScrollLeft = startIdx > 0
    const canScrollRight = endIdx < sortedBadges.length

    return (
        <div className={twMerge('space-y-3', className)}>
            <h2 className="text-base font-bold">Badges</h2>
            <Card position="single" className="relative flex h-20 items-center justify-center">
                {/* Badge viewport container */}
                <div
                    ref={viewportRef}
                    className="flex w-11/12 items-center justify-center gap-4 overflow-hidden"
                    role="region"
                    aria-label="Badge collection"
                >
                    {visibleBadges
                        // dev-note: dev-connect badge to be shown in ui after post devconnect marketing campaign
                        .filter((badge) => badge.code.toLowerCase() !== 'devconnect_ba_2025')
                        .map((badge) => {
                            // use public description if viewing someone else's profile, otherwise use original
                            const displayDescription = isSelfProfile
                                ? badge.description
                                : getPublicBadgeDescription(badge.code) || badge.description

                            return (
                                <Tooltip
                                    key={badge.code}
                                    content={
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <div className="relative text-sm font-bold">{badge.name}</div>
                                            <p className="text-center font-normal">{displayDescription}</p>
                                        </div>
                                    }
                                >
                                    <Image
                                        src={getBadgeIcon(badge.code)}
                                        alt={badge.name}
                                        className="min-h-10 min-w-10 object-contain"
                                        height={48}
                                        width={48}
                                        unoptimized
                                    />
                                </Tooltip>
                            )
                        })}
                </div>

                {/* Right navigation button */}
                {canScrollRight && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                        <Button
                            variant="transparent-dark"
                            size="small"
                            onClick={scrollRight}
                            aria-label="Show next badges"
                        >
                            <Icon name="chevron-up" className="h-9 rotate-90" />
                        </Button>
                    </div>
                )}

                {/* Left navigation button */}
                {canScrollLeft && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                        <Button
                            variant="transparent-dark"
                            size="small"
                            onClick={scrollLeft}
                            aria-label="Show previous badges"
                        >
                            <Icon name="chevron-up" className="h-9 -rotate-90" />
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    )
}

export default BadgesRow
