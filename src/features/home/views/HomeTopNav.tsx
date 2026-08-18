'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { useHaptic } from 'use-haptic'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface HomeTopNavProps {
    avatarName?: string
    showRewards: boolean
}

/**
 * home top navigation row (figma home board 17830:75689): 48px avatar
 * top-left linking to /profile, rewards link top-right.
 */
export function HomeTopNav({ avatarName, showRewards }: HomeTopNavProps) {
    const t = useTranslations('home')
    const { triggerHaptic } = useHaptic()

    return (
        <div className="flex items-center justify-between">
            <Link href="/profile" onClick={() => triggerHaptic()} className="block">
                {/* usernameless users get a bordered user-icon circle instead of
                    an invisible (colorless) initials avatar */}
                <AvatarWithBadge
                    size="small"
                    name={avatarName}
                    icon={avatarName ? undefined : 'user'}
                    className={avatarName ? undefined : 'border border-border-default'}
                />
            </Link>
            {showRewards && (
                <Link href="/rewards" onClick={() => triggerHaptic()} className="flex items-center gap-1">
                    <InvitesIcon />
                    <span className="text-button-m whitespace-nowrap text-foreground-primary">{t('rewards')}</span>
                    <Icon name="chevron-right" size={20} className="text-foreground-primary" />
                </Link>
            )}
        </div>
    )
}
