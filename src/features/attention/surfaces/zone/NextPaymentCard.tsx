'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useModalsContext } from '@/context/ModalsContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useAttention } from '../../AttentionProvider'
import type { ZoneSurfaceProps } from '../../types'

/** A funded, activated user who has not spent for a while: QR where it is open, the card otherwise. */
export default function NextPaymentCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    const { setIsQRScannerOpen } = useModalsContext()
    const { state } = useAttention()
    return (
        <CarouselCTA
            title={t('nextPayment.title')}
            description={t('nextPayment.description')}
            concept={state.qr.canPayNow ? 'qrPay' : 'card'}
            onClose={onDismissed}
            onClick={() => (state.qr.canPayNow ? setIsQRScannerOpen(true) : router.push('/card'))}
        />
    )
}
