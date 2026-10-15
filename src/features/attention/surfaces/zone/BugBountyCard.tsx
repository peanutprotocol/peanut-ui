'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useModalsContext } from '@/context/ModalsContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** Bug bounty for activated users; the SUPPORT_SURVIVOR badge is the server-side "already claimed". */
export default function BugBountyCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const { openSupportWithMessage } = useModalsContext()
    return (
        <CarouselCTA
            title={<span>{t.rich('bugBounty.title', { b })}</span>}
            description={t('bugBounty.description')}
            iconContainerClassName="bg-action-primary"
            icon="bug"
            iconSize={20}
            onClose={onDismissed}
            // the chat lives inside SupportDrawer's iframe on (mobile-ui) routes
            onClick={() => openSupportWithMessage('I found a bug: ')}
        />
    )
}
