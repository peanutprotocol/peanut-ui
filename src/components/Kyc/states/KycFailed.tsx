import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KycStatusItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils'
import { CountryRegionRow } from '../CountryRegionRow'

// this component shows the kyc status when it's failed/rejected.
// it displays the reason for the failure and provides a retry button.
export const KycFailed = ({
    reason,
    bridgeKycRejectedAt,
    countryCode,
    isBridge,
    onRetry,
    isLoading,
}: {
    reason: string | null
    bridgeKycRejectedAt?: string
    countryCode?: string | null
    isBridge?: boolean
    onRetry: () => void
    isLoading?: boolean
}) => {
    const rejectedOn = useMemo(() => {
        if (!bridgeKycRejectedAt) return 'N/A'
        try {
            return formatDate(new Date(bridgeKycRejectedAt))
        } catch (error) {
            console.error('Failed to parse bridgeKycRejectedAt date:', error)
            return 'N/A'
        }
    }, [bridgeKycRejectedAt])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />
            <Card position="single">
                <PaymentInfoRow label="Rejected on" value={rejectedOn} />

                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} />

                <PaymentInfoRow
                    label="Reason"
                    value={reason || 'There was an issue. Contact Support.'}
                    hideBottomBorder
                />
            </Card>
            <Button
                icon="retry"
                variant="purple"
                className="w-full"
                shadowSize="4"
                onClick={onRetry}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Retry verification'}
            </Button>
        </div>
    )
}
