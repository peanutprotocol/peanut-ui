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
    const canPayQr = state.qr.canPayNow
    const canPayCard = state.cardOffer.canSpendViaCard === true
    return (
        <CarouselCTA
            title={t('nextPayment.title')}
            description={t(
                canPayQr && canPayCard
                    ? 'nextPayment.descriptionQrOrCard'
                    : canPayQr
                      ? 'nextPayment.descriptionQr'
                      : 'nextPayment.descriptionCard'
            )}
            concept={canPayQr ? 'qrPay' : 'card'}
            onClose={onDismissed}
            onClick={() => {
                if (canPayQr) setIsQRScannerOpen(true)
                else if (canPayCard) router.push('/card')
            }}
        />
    )
}
