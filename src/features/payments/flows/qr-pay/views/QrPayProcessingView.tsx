'use client'

import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

export function QrPayProcessingView() {
    const t = useAppTranslations('qrPay')
    return <ProcessingScreen title={t('processingPaymentTitle')} description={t('processingPaymentBody')} />
}
