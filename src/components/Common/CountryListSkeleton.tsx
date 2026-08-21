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
                const position = getCardPosition(index, 5)
                return (
                    <ListItem
                        key={index}
                        title={<div className="bg-gray-200 h-4 w-24 animate-pulse rounded" />}
                        position={position}
                        chevron
                        leading={<div className="bg-gray-200 h-8 w-8 animate-pulse rounded-full" />}
                    />
                )
            })}
        </div>
    )
}
