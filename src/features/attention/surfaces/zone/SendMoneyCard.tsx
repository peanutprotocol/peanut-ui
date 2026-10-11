'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useHomeDrawer } from '@/features/home/useHomeDrawer'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** Send money to someone: opens Home's send drawer. */
export default function SendMoneyCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const [, setHomeDrawer] = useHomeDrawer()
    return (
        <CarouselCTA
            title={t('sendMoney.title')}
            description={t('sendMoney.description')}
            concept="sendLink"
            onClose={onDismissed}
            onClick={() => void setHomeDrawer('send')}
        />
    )
}
