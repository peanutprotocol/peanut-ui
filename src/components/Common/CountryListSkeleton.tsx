'use client'
import { ActionListCard } from '../ActionListCard'
import { getCardPosition } from '../Global/Card'

/**
 * Displays a country list skeleton!
 */
export const CountryListSkeleton = () => {
    return (
        <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 10 }).map((_, index) => {
                const position = getCardPosition(index, 5)
                return (
                    <ActionListCard
                        key={index}
                        title={<div className="h-4 w-24 animate-pulse rounded bg-gray-200" />}
                        position={position}
                        onClick={() => {}}
                        leftIcon={<div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />}
                    />
                )
            })}
        </div>
    )
}
