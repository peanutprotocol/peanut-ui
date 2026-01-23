'use client'
import { ActionListCard } from '../ActionListCard'
import { getCardPosition } from '../Global/Card/card.utils'

/**
 * displays a contacts list skeleton during loading
 */
export const ContactsListSkeleton = ({ count = 10 }: { count?: number }) => {
    return (
        <div className="space-y-2">
            <h2 className="text-base font-bold">Your contacts</h2>
            <div className="flex-1 space-y-0 overflow-y-auto">
                {Array.from({ length: count }).map((_, index) => {
                    const position = getCardPosition(index, count)
                    return (
                        <ActionListCard
                            key={index}
                            title={<div className="h-4 w-32 animate-pulse rounded bg-gray-200" />}
                            position={position}
                            onClick={() => {}}
                            leftIcon={<div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />}
                        />
                    )
                })}
            </div>
        </div>
    )
}
