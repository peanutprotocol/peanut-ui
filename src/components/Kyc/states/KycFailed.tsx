import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KycStatusItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils'

// this component shows the kyc status when it's failed/rejected.
// it displays the reason for the failure and provides a retry button.
export const KycFailed = ({
    reason,
    kycRejectedAt,
    onRetry,
}: {
    reason: string | null
    kycRejectedAt?: string
    onRetry: () => void
}) => {
    const rejectedOn = useMemo(() => {
        if (!kycRejectedAt) return 'N/A'
        try {
            return formatDate(new Date(kycRejectedAt))
        } catch (error) {
            console.error('Failed to parse kycRejectedAt date:', error)
            return 'N/A'
        }
    }, [kycRejectedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />
            <Card position="single">
                <PaymentInfoRow label="Rejected on" value={rejectedOn} />

                <PaymentInfoRow label="Reason" value={reason || 'An unknown error occurred.'} hideBottomBorder />
            </Card>
            {/* as requested, this button is currently for ui purposes and will be implemented later. */}
            <Button icon="retry" variant="purple" className="w-full" shadowSize="4" onClick={onRetry}>
                Retry verification
            </Button>
        </div>
    )
}
