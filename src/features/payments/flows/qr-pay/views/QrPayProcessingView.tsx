'use client'

import PaymentProcessingScreen from '@/components/Global/PaymentProcessingScreen'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

export function QrPayProcessingView() {
    const t = useAppTranslations('qrPay')

    return <PaymentProcessingScreen title={t('processingPaymentTitle')} />
}
