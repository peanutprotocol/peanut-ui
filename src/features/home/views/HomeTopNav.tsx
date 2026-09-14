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

// Keep the raw Link on the same recipe as Button. The merge removes Button's
// base w-full so the navigation control stays a 40px circle like NavHeader's
// back button instead of expanding to the whole header row.
const menuButton = twMerge(
    'btn btn-stroke flex w-full items-center gap-2 transition-all duration-instant active:translate-x-1 active:translate-y-1 active:shadow-none',
    'relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5'
)

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
