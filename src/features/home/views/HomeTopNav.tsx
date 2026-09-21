'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { Icon } from '@/components/Global/Icons/Icon'
import InvitesIcon from '@/components/Home/InvitesIcon'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Link from 'next/link'

interface HomeTopNavProps {
    showRewards: boolean
}

export function HomeTopNav({ showRewards }: HomeTopNavProps) {
    const t = useAppTranslations('home')
    const { triggerHaptic } = useAppHaptic()

    return (
        <div className="flex items-center justify-between">
            {/* link-mode Button — ONE anchor, no nested interactive (the test
                asserts this). 40px circle like NavHeader's back button. */}
            <Button
                variant="transparent"
                href="/profile"
                className={NAV_CIRCLE_BUTTON_CLASSES}
                aria-label={t('openProfile')}
            >
                <Icon name="menu" size={20} />
            </Button>
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
