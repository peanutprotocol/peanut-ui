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

// Raw Link styled with the btn recipe classes — the navigation control stays
// a 40px circle like NavHeader's back button. Deliberately not a nested
// Button (a11y: no interactive-in-interactive; the test asserts this).
const menuButton = twMerge(
    'btn btn-stroke gap-2',
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
