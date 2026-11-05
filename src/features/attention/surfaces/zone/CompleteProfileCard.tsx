'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** A name helps friends recognise a payer; asked only once the account is in use. */
export default function CompleteProfileCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('completeProfile.title')}
            description={t('completeProfile.description')}
            icon="user-plus"
            onClose={onDismissed}
            onClick={() => router.push('/profile/edit')}
        />
    )
}
