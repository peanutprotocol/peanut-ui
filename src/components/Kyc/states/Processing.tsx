import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KycStatusItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils'

// this component shows the kyc status while it's being processed.
export const Processing = ({ kycStartedAt }: { kycStartedAt?: string }) => {
    const submittedOn = useMemo(() => {
        if (!kycStartedAt) return 'N/A'
        try {
            return formatDate(new Date(kycStartedAt))
        } catch (error) {
            console.error('Failed to parse kycStartedAt date:', error)
            return 'N/A'
        }
    }, [kycStartedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="processing" />
            <Card position="single">
                <PaymentInfoRow label="Submitted" value={submittedOn} />

                <PaymentInfoRow
                    label="Status"
                    value="We're reviewing your documents. This usually takes 5-10 min."
                    hideBottomBorder
                />
            </Card>
        </div>
    )
}
