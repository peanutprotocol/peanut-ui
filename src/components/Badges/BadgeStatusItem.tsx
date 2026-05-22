import { useState, useMemo } from 'react'
import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { BadgeStatusDrawer } from './BadgeStatusDrawer'
import Image from 'next/image'
import InvitesIcon from '../Home/InvitesIcon'
import { getBadgeIcon } from './badge.utils'
import { type BadgeHistoryEntry } from './badge.types'

export const BadgeStatusItem = ({
    position = 'first',
    entry,
}: {
    position?: CardPosition
    entry: BadgeHistoryEntry
}) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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
            <Card
                position={position}
                className="flex cursor-pointer items-center gap-4"
                onClick={() => setIsDrawerOpen(true)}
            >
                {/* badge icon */}
                <div className={'relative flex h-8 w-8 items-center justify-center rounded-full'}>
                    <Image
                        src={getBadgeIcon(entry.code)}
                        alt={`${entry.name} icon`}
                        className="size-10 object-contain"
                        width={32}
                        height={32}
                    />
                </div>

                {/* text content */}
                <div className="flex-1">
                    <div className="flex flex-row items-center gap-2">
                        <div className="min-w-0 flex-1 truncate font-roboto text-[16px] font-medium">{entry.name}</div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-1">
                        <span className="capitalize">Badge unlocked!</span>
                    </div>
                </div>

                <InvitesIcon animate={false} className="size-4" />
            </Card>

            <BadgeStatusDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} badge={badge} />
        </>
    )
}
