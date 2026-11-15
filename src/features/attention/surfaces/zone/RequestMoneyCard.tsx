'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useHomeDrawer } from '@/features/home/useHomeDrawer'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** Request money: opens Home's request drawer. */
export default function RequestMoneyCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const [, setHomeDrawer] = useHomeDrawer()
    return (
        <CarouselCTA
            title={t('requestMoney.title')}
            description={t('requestMoney.description')}
            concept="requestLink"
            onClose={onDismissed}
            onClick={() => void setHomeDrawer('request')}
        />
    )
}
