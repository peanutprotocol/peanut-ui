'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { StuckDrawerShell } from './StuckDrawerShell'

interface HomeFundedDrawerProps {
    open: boolean
    onClose: () => void
    onNavigate: (href: string) => void
    onContactSupport: (topic: string) => void
}

export function HomeFundedDrawer({ open, onClose, onNavigate, onContactSupport }: HomeFundedDrawerProps) {
    const t = useTranslations('stuckBuddy')

    return (
        <StuckDrawerShell
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
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
                        onNavigate('/qr-pay')
                    }}
                    data-testid="stuck-drawer-qr"
                >
                    {t('drawers.homeFunded.qrCta')}
                </Button>
                <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => {
                        onClose()
                        onNavigate('/card')
                    }}
                    data-testid="stuck-drawer-card"
                >
                    {t('drawers.homeFunded.cardCta')}
                </Button>
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
