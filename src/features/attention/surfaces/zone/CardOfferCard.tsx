'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** The public card offer for an activated user with no card relationship. */
export default function CardOfferCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={<span>{t.rich('card.title', { b })}</span>}
            description={<span>{t.rich('card.description', { b })}</span>}
            concept="card"
            iconSize={16}
            onClose={onDismissed}
            onClick={() => router.push('/card')}
        />
    )
}
