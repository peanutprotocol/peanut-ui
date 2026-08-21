'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Link from 'next/link'

interface HomeTopNavProps {
    avatarName?: string
    showRewards: boolean
}

/**
 * home top navigation row (figma home board 17830:75689): 32px avatar
 * top-left linking to /profile (Vlad follow-up: one size down from 48),
 * rewards link top-right. The link keeps a 44px hit area via after: inset.
 */
export function HomeTopNav({ avatarName, showRewards }: HomeTopNavProps) {
    const t = useAppTranslations('home')
    const { triggerHaptic } = useAppHaptic()

    return (
        <div className="flex items-center justify-between">
            <Link
                href="/profile"
                onClick={() => triggerHaptic()}
                // 32px visual — extend the pressable area to 44px (touch-target law)
                className="relative block after:absolute after:-inset-1.5"
                aria-label={t('openProfile')}
            >
                {/* figma avatar = initials on the avatar palette. a user with no
                    name string at all still gets an avatar-toned circle (yellow —
                    the palette's no-name default) instead of a generic icon */}
                <AvatarWithBadge
                    size="extra-small"
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
