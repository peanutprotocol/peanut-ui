'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** "Unlock QR payments": starts the QR ID check in place. */
export default function VerifyForQrCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const qrIdentityCheck = useQrIdentityCheck()
    return (
        <>
            <CarouselCTA
                title={<span>{t.rich('kyc.title', { b })}</span>}
                description={<span>{t.rich('kyc.description', { b })}</span>}
                concept="qrPay"
                iconSize={16}
                onClose={onDismissed}
                onClick={() => qrIdentityCheck.start()}
            />
            {qrIdentityCheck.modals}
        </>
    )
}
