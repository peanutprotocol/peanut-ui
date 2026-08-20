'use client'
import { useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
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
                        <ListItem
                            key={index}
                            title={<div className="bg-gray-200 h-4 w-32 animate-pulse rounded" />}
                            position={position}
                            chevron
                            leading={<div className="bg-gray-200 h-8 w-8 animate-pulse rounded-full" />}
                        />
                    )
                })}
            </div>
        </div>
    )
}
