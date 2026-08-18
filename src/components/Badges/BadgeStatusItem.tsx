import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { BadgeStatusDrawer } from './BadgeStatusDrawer'
import InvitesIcon from '../Home/InvitesIcon'
import { getBadgeIcon } from './badge.utils'
import { useBadgeCopy } from './useBadgeCopy'
import { type BadgeHistoryEntry } from './badge.types'
import { BadgeImage } from './BadgeImage'

export const BadgeStatusItem = ({
    position = 'first',
    entry,
}: {
    position?: CardPosition
    entry: BadgeHistoryEntry
}) => {
    const t = useTranslations('badges')
    const badgeCopy = useBadgeCopy()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const displayName = badgeCopy(entry.code, entry.name).name

    const badge = useMemo(
        () => ({
            code: entry.code,
            name: entry.name,
            description: entry.description,
            iconUrl: entry.iconUrl || undefined,
            earnedAt: entry.timestamp,
        }),
        [entry]
    )

    return (
        <>
            <ListItem
                position={position}
                onClick={() => setIsDrawerOpen(true)}
                leading={
                    <div className={'relative flex h-8 w-8 items-center justify-center rounded-full'}>
                        <BadgeImage
                            src={getBadgeIcon(entry.code, entry.iconUrl)}
                            alt={t('iconAlt', { name: displayName })}
                            className="size-10 object-contain"
                            width={32}
                            height={32}
                        />
                    </div>
                }
                title={displayName}
                body={t('unlocked')}
                trailing={<InvitesIcon animate={false} className="size-4" />}
            />

            <BadgeStatusDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} badge={badge} />
        </>
    )
}
