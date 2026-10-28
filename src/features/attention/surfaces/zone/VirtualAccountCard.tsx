'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** Reusable bank details for a user who can claim an account and has none yet. */
export default function VirtualAccountCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('virtualAccount.title')}
            description={t('virtualAccount.description')}
            concept="addMoney"
            onClose={onDismissed}
            onClick={() => router.push('/add-money')}
        />
    )
}
