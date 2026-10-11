'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useAttention } from '../../AttentionProvider'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** Invite someone: the LatAm cashback copy in Argentina and Brazil, the generic copy elsewhere. */
export default function InviteCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    const { state } = useAttention()
    const latam = state.geoCountry === 'AR' || state.geoCountry === 'BR'
    return (
        <CarouselCTA
            title={latam ? <span>{t.rich('latamInvite.title', { b })}</span> : t('invite.title')}
            description={latam ? <span>{t.rich('latamInvite.description', { b })}</span> : t('invite.description')}
            concept="rewards"
            iconSize={latam ? 16 : undefined}
            onClose={onDismissed}
            onClick={() => router.push('/rewards')}
        />
    )
}
