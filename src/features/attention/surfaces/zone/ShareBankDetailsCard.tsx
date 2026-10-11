'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** An employer or client can pay into the account; opening the details counts as shared. */
export default function ShareBankDetailsCard({ onActed, onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('shareBankDetails.title')}
            description={t('shareBankDetails.description')}
            concept="addMoney"
            onClose={onDismissed}
            onClick={() => {
                onActed()
                router.push('/add-money')
            }}
        />
    )
}
