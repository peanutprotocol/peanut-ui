'use client'

import Card from '@/components/Global/Card'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Tooltip } from '../Tooltip'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'
import { Icon } from '../Global/Icons/Icon'

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
    includeMocks?: boolean
}

/**
 * A horizontally scrollable badge display component with navigation controls.
 * Displays user badges in a card with automatic responsive sizing and pagination.
 * - Responsive width calculation based on viewport
 * - Left/right navigation buttons for scrolling through badges
 * - Tooltips showing badge name and description on hover
 * - Automatic sorting by earned date (newest first)
 * - Mock badges support for UI testing
 */
export function BadgesRow({ badges, className, includeMocks = true }: BadgesRowProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const [visibleCount, setVisibleCount] = useState<number>(4)
    const [startIdx, setStartIdx] = useState<number>(0)

    /**
     * Mock badges for stress-testing the UI
     * Memoized to prevent recreation on every render
     */
    const MOCK_BADGES: UIBadge[] = useMemo(
        () =>
            Array.from({ length: 10 }, (_, i) => ({
                code: `MOCK_${i + 1}`,
                name: `Badge ${i + 1}`,
                description: `badge ${i + 1} description`,
                iconUrl: 'https://res.cloudinary.com/dtactyu3j/image/upload/v1759946769/beta-tester_he75gf.svg',
                earnedAt: undefined,
            })),
        []
    )
    // sort by earnedAt, newest first
    const sortedBadges = useMemo(() => {
        const source = includeMocks ? [...badges, ...MOCK_BADGES] : badges
        return source.sort((a, b) => {
            const at = a.earnedAt ? new Date(a.earnedAt).getTime() : 0
            const bt = b.earnedAt ? new Date(b.earnedAt).getTime() : 0
            return bt - at
        })
    }, [badges, includeMocks, MOCK_BADGES])

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
                    {visibleBadges.map((badge, idx) => (
                        <Tooltip
                            key={`${badge.code}-${startIdx + idx}`}
                            content={
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <div className="relative text-sm font-bold">{badge.name}</div>
                                    <p className="text-center font-normal">{badge.description}</p>
                                </div>
                            }
                        >
                            <Image
                                src={badge.iconUrl || '/logo-favicon.png'}
                                alt={badge.name}
                                className="min-h-12 min-w-12 object-contain"
                                height={64}
                                width={64}
                                unoptimized
                            />
                        </Tooltip>
                    ))}
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
