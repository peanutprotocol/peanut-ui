'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useModalsContext } from '@/context/ModalsContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** "Pay with QR" for a user who can pay a QR right now and has not yet. */
export default function QrPaymentCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const { setIsQRScannerOpen } = useModalsContext()
    return (
        <CarouselCTA
            title={<span>{t.rich('qrPay.title', { b })}</span>}
            description={<span>{t.rich('qrPay.description', { b })}</span>}
            concept="qrPay"
            iconSize={16}
            onClose={onDismissed}
            onClick={() => setIsQRScannerOpen(true)}
        />
    )
}
