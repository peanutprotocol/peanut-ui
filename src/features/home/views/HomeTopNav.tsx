'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import DotFaceAvatar from '@/components/Global/DotFaceAvatar'
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
                {/* The generated face, which is what DotFaceAvatar exists for —
                    own identity, here and on the profile header. This chip was
                    rebuilt onto initials during the nav consolidation and the
                    face was left behind in UserHeader, which nothing renders.
                    A user with no name string at all still gets an avatar-toned
                    circle (yellow — the palette's no-name default). */}
                {avatarName ? (
                    <DotFaceAvatar username={avatarName} size={32} />
                ) : (
                    <AvatarWithBadge
                        size="extra-small"
                        icon="user"
                        className="border border-avatar-yellow-border bg-avatar-yellow text-avatar-yellow-foreground"
                        iconFillColor="var(--color-avatar-yellow-foreground)"
                    />
                )}
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
