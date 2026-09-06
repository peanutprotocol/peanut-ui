'use client'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '../Global/Card/card.utils'

/**
 * Displays a country list skeleton!
 */
export const CountryListSkeleton = () => {
    return (
        <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 10 }).map((_, index) => {
                const position = getCardPosition(index, 10)
                return (
                    <ListItem
                        key={index}
                        title={<div className="h-4 w-24 animate-pulse rounded bg-foreground-primary/10" />}
                        position={position}
                        chevron
                        leading={<div className="h-8 w-8 animate-pulse rounded-full bg-foreground-primary/10" />}
                    />
                )
            })}
        </div>
    )
}
