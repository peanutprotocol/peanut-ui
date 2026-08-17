'use client'
import { useTranslations } from 'next-intl'
import { ActionListCard } from '../ActionListCard'
import { getCardPosition } from '../Global/Card/card.utils'

/**
 * displays a contacts list skeleton during loading
 */
export const ContactsListSkeleton = ({ count = 10 }: { count?: number }) => {
    const t = useTranslations('global')
    return (
        <div className="space-y-2">
            <h2 className="text-base font-bold">{t('contactsList.title')}</h2>
            <div className="space-y-0 flex-1 overflow-y-auto">
                {Array.from({ length: count }).map((_, index) => {
                    const position = getCardPosition(index, count)
                    return (
                        <ActionListCard
                            key={index}
                            title={<div className="bg-gray-200 h-4 w-32 animate-pulse rounded" />}
                            position={position}
                            onClick={() => {}}
                            leftIcon={<div className="bg-gray-200 h-8 w-8 animate-pulse rounded-full" />}
                        />
                    )
                })}
            </div>
        </div>
    )
}
