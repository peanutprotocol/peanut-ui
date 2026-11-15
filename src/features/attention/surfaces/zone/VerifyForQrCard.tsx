'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useAttentionFlows } from '../AttentionFlowContext'
import type { ZoneSurfaceProps } from '../../types'

const b = (chunks: React.ReactNode) => <b>{chunks}</b>

/** "Unlock QR payments": starts the QR ID check in place. */
export default function VerifyForQrCard(props: ZoneSurfaceProps) {
    const flows = useAttentionFlows()
    return flows ? <VerifyForQrView {...props} qrIdentityCheck={flows.qr} hosted /> : <StandaloneQrCard {...props} />
}

function StandaloneQrCard(props: ZoneSurfaceProps) {
    const qrIdentityCheck = useQrIdentityCheck()
    return <VerifyForQrView {...props} qrIdentityCheck={qrIdentityCheck} />
}

function VerifyForQrView({
    onDismissed,
    qrIdentityCheck,
    hosted = false,
}: ZoneSurfaceProps & { qrIdentityCheck: ReturnType<typeof useQrIdentityCheck>; hosted?: boolean }) {
    const t = useAppTranslations('home.carousel')
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
            {!hosted && qrIdentityCheck.modals}
        </>
    )
}
