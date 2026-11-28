'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { StuckDrawerShell } from './StuckDrawerShell'

interface HomeFundedDrawerProps {
    open: boolean
    canUseQrPay: boolean
    canUseCard: boolean
    onClose: () => void
    onNavigate: (href: string) => void
    onContactSupport: (topic: string) => void
}

export function HomeFundedDrawer({
    open,
    canUseQrPay,
    canUseCard,
    onClose,
    onNavigate,
    onContactSupport,
}: HomeFundedDrawerProps) {
    const t = useTranslations('stuckBuddy')

    const primaryAction = canUseQrPay
        ? { href: '/qr-pay', label: t('drawers.homeFunded.qrCta'), testId: 'stuck-drawer-qr' }
        : canUseCard
          ? { href: '/card', label: t('drawers.homeFunded.cardCta'), testId: 'stuck-drawer-card' }
          : { href: '/send', label: t('drawers.homeFunded.sendCta'), testId: 'stuck-drawer-send' }

    const secondaryAction =
        canUseQrPay && canUseCard
            ? { href: '/card', label: t('drawers.homeFunded.cardCta'), testId: 'stuck-drawer-card' }
            : primaryAction.href !== '/send'
              ? { href: '/send', label: t('drawers.homeFunded.sendCta'), testId: 'stuck-drawer-send' }
              : null

    return (
        <StuckDrawerShell
            open={open}
            onClose={onClose}
            icon="star"
            iconColor="yellow"
            title={t('drawers.homeFunded.title')}
            description={t('drawers.homeFunded.description')}
            testId="stuck-drawer-home_funded"
        >
            <div className="flex w-full flex-col items-center gap-4">
                <Button
                    className="w-full justify-center"
                    onClick={() => {
                        onClose()
                        onNavigate(primaryAction.href)
                    }}
                    data-testid={primaryAction.testId}
                >
                    {primaryAction.label}
                </Button>
                {secondaryAction && (
                    <Button
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => {
                            onClose()
                            onNavigate(secondaryAction.href)
                        }}
                        data-testid={secondaryAction.testId}
                    >
                        {secondaryAction.label}
                    </Button>
                )}
                <div className="mt-2">
                    <LinkButton
                        onClick={() => {
                            onContactSupport(t('supportTopics.homeFunded'))
                            onClose()
                        }}
                    >
                        {t('drawers.homeFunded.tertiarySupport')}
                    </LinkButton>
                </div>
            </div>
        </StuckDrawerShell>
    )
}
