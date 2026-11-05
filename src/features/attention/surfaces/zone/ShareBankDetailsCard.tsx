'use client'

import { bankDetailsHref } from './bankDetailsRoute'
import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

export default function ShareBankDetailsCard({ onSnoozed, onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('shareBankDetails.title')}
            description={t('shareBankDetails.description')}
            concept="addMoney"
            onClose={onDismissed}
            onClick={() => {
                router.push(bankDetailsHref())
                onSnoozed()
            }}
        />
    )
}
