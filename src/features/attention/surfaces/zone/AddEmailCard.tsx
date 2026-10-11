'use client'

import { useState } from 'react'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** No email on the account: the capture sheet opens in place. */
export default function AddEmailCard({ onActed, onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const [open, setOpen] = useState(false)
    return (
        <>
            <CarouselCTA
                title={t('addEmail.title')}
                description={t('addEmail.description')}
                icon="user"
                onClose={onDismissed}
                onClick={() => setOpen(true)}
            />
            <ProvideEmailStep
                visible={open}
                onComplete={() => {
                    setOpen(false)
                    onActed()
                }}
                onSkip={() => {
                    setOpen(false)
                    onDismissed()
                }}
            />
        </>
    )
}
