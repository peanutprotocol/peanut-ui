import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

// this component shows the identity-verification status while it's being processed.
// The API omits submittedAt when it has no real submission time (api#1650
// removed a made-up date), so a missing or unreadable date drops the row
// rather than saying "not available".
export const KycProcessing = ({ submittedAt }: { submittedAt?: string }) => {
    const t = useTranslations('kyc')
    const format = useFormatter()

    const submittedOn = useMemo(() => {
        if (!submittedAt) return null
        try {
            const date = new Date(submittedAt)
            if (isNaN(date.getTime())) return null
            return format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
        } catch (error) {
            console.error('Failed to parse submittedAt date:', error)
            return null
        }
    }, [submittedAt, format])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="processing" />
            <Card position="solo">
                {submittedOn && <PaymentInfoRow label={t('submitted')} value={submittedOn} />}
                <PaymentInfoRow label={t('status')} value={t('processingStatusValue')} hideBottomBorder />
            </Card>
        </div>
    )
}
