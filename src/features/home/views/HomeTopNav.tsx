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
                className="relative block after:absolute after:-inset-1.5"
                aria-label={t('openProfile')}
            >
                {/* The user's picked avatar (TASK-22142), or the privacy-safe
                    fallback: one username initial on its color. Never the full
                    name — that is verification data. */}
                <UserAvatar username={username} avatarKey={avatarKey} size="extra-small" />
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
