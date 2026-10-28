'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** Pending rewards; opening Rewards counts as seen until the balance changes. */
export default function RewardsCard({ onActed, onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('rewards.title')}
            description={t('rewards.description')}
            concept="rewards"
            onClose={onDismissed}
            onClick={() => {
                onActed()
                router.push('/rewards')
            }}
        />
    )
}
