'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { useAppHaptic } from '@/hooks/useAppHaptic'
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
    const { triggerHaptic } = useAppHaptic()

    return (
        <div className="flex items-center justify-between">
            <Link href="/profile" onClick={() => triggerHaptic()} className="block" aria-label={t('openProfile')}>
                {/* figma avatar = initials on the avatar palette. a user with no
                    name string at all still gets an avatar-toned circle (yellow —
                    the palette's no-name default) instead of a generic icon */}
                <AvatarWithBadge
                    size="small"
                    name={avatarName}
                    icon={avatarName ? undefined : 'user'}
                    className={
                        avatarName
                            ? undefined
                            : 'border border-avatar-yellow-border bg-avatar-yellow text-avatar-yellow-foreground'
                    }
                    iconFillColor={avatarName ? undefined : 'var(--color-avatar-yellow-foreground)'}
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
