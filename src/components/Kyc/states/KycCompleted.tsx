import Card from '@/components/Global/Card'
import { KYCStatusDrawerItem } from '../KycStatusItem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMemo } from 'react'
import { formatDate } from '@/utils'

// this component shows the kyc status when it's completed/approved.
export const KycCompleted = ({ bridgeKycApprovedAt }: { bridgeKycApprovedAt?: string }) => {
    const verifiedOn = useMemo(() => {
        if (!bridgeKycApprovedAt) return 'N/A'
        try {
            return formatDate(new Date(bridgeKycApprovedAt))
        } catch (error) {
            console.error('Failed to parse kycCompletedAt date:', error)
            return 'N/A'
        }
    }, [bridgeKycApprovedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="completed" />
            <Card position="single">
                <PaymentInfoRow label="Verified on" value={verifiedOn} />
                <PaymentInfoRow
                    label="Status"
                    value="You're all set! You can now withdraw funds to your bank."
                    hideBottomBorder
                />
            </Card>
        </div>
    )
}
