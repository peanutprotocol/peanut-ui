import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

// this component shows the identity-verification status while it's being processed.
export const KycProcessing = ({ submittedAt }: { submittedAt?: string }) => {
    const t = useTranslations('kyc')
    const format = useFormatter()

    const submittedOn = useMemo(() => {
        if (!submittedAt) return t('notAvailable')
        try {
            const date = new Date(submittedAt)
            if (isNaN(date.getTime())) return t('notAvailable')
            return format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
        } catch (error) {
            console.error('Failed to parse submittedAt date:', error)
            return t('notAvailable')
        }
    }, [submittedAt, format, t])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="processing" />
            <Card position="single">
                <PaymentInfoRow label={t('submitted')} value={submittedOn} />
                <PaymentInfoRow label={t('status')} value={t('processingStatusValue')} hideBottomBorder />
            </Card>
        </div>
    )
}
