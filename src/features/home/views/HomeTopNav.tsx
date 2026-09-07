'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { twMerge } from '@/utils/tw'
import Link from 'next/link'

interface HomeTopNavProps {
    showRewards: boolean
}

// The stroke Button's recipe on a Link, not <Link><Button> — nesting them is
// two tab stops and an axe nested-interactive violation, and this control
// navigates, so the anchor is the honest element (precedent: Careers.tsx).
// Line 1 is what Button.tsx composes around `btn`/`btn-stroke`; line 2 is the
// board 17802:61534 top-nav circle NavHeader uses — 40px visual, no shadow,
// pseudo-element extending the hit area to 44px (touch-target law). twMerge,
// as in Button, is what resolves size-10/w-10 against the base w-full.
const menuButton = twMerge(
    'btn btn-stroke flex w-full items-center gap-2 transition-all duration-instant active:translate-x-1 active:translate-y-1 active:shadow-none',
    'relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5'
)

/**
 * home top navigation row (figma home board 17830:75689): the menu button
 * top-left linking to /profile, rewards link top-right.
 *
 * The avatar chip is gone (TASK-22142). The sticker is identity, and identity
 * lives on /profile and in the picker; up here a lone sticker read as
 * decoration rather than a way in — even with a chevron bolted on to say so.
 * A menu button says "opens something" without borrowing the avatar for it.
 */
export function HomeTopNav({ showRewards }: HomeTopNavProps) {
    const t = useAppTranslations('home')
    const { triggerHaptic } = useAppHaptic()

    return (
        <div className="flex items-center justify-between">
            <Link href="/profile" onClick={() => triggerHaptic()} className={menuButton} aria-label={t('openProfile')}>
                <Icon name="menu" size={20} />
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
