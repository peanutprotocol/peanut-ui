import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'

// this component shows the identity-verification status while it's being processed.
export const KycProcessing = ({ submittedAt }: { submittedAt?: string }) => {
    const submittedOn = useMemo(() => {
        if (!submittedAt) return 'N/A'
        try {
            return formatDate(new Date(submittedAt))
        } catch (error) {
            console.error('Failed to parse submittedAt date:', error)
            return 'N/A'
        }
    }, [submittedAt])

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
