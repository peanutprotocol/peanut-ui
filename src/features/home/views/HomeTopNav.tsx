'use client'

import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Link from 'next/link'

interface HomeTopNavProps {
    username?: string
    avatarKey?: string | null
    showRewards: boolean
}

/**
 * home top navigation row (figma home board 17830:75689): 32px avatar
 * top-left linking to /profile (Vlad follow-up: one size down from 48),
 * rewards link top-right. The link keeps a 44px hit area via after: inset.
 */
export function HomeTopNav({ username, avatarKey, showRewards }: HomeTopNavProps) {
    const t = useAppTranslations('home')
    const { triggerHaptic } = useAppHaptic()

    return (
        <div className="flex items-center justify-between">
            <Link
                href="/profile"
                onClick={() => triggerHaptic()}
                // 32px visual — extend the pressable area to 44px (touch-target law)
                className="relative flex items-center gap-0.5 after:absolute after:-inset-1.5"
                aria-label={t('openProfile')}
            >
                {/* Own identity: the picked avatar (TASK-22142), or the first
                    letter of the USERNAME — the same seed as the profile header,
                    so the letter and its palette never follow the display name.
                    No username yet still gets an avatar-toned circle (yellow —
                    the palette's no-name default). */}
                <UserAvatar name={username} avatarKey={avatarKey} size="extra-small" />
                {/* A lone sticker reads as decoration; the chevron is what says
                    it opens something. Decorative — the Link already has a label. */}
                <Icon name="chevron-down" size={16} className="text-foreground-secondary" aria-hidden />
            </Link>
            {showRewards && (
                <Link
                    href="/rewards"
                    onClick={() => triggerHaptic()}
                    // 20px visual — extend the pressable area to 44px (touch-target law)
                    className="relative flex items-center gap-1 after:absolute after:-inset-3"
                >
                    <InvitesIcon />
                    <span className="text-button-m whitespace-nowrap text-foreground-primary">{t('rewards')}</span>
                    <Icon name="chevron-right" size={20} className="text-foreground-primary" />
                </Link>
            )}
        </div>
    )
}
