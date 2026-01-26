import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'
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

    const formattedReason = useMemo(() => {
        const reasonText = reason || 'There was an issue. Contact Support.'
        // Split by actual newline characters (\n) or the escaped sequence (\\n)
        const lines = reasonText.split(/\\n|\n/).filter((line) => line.trim() !== '')

        if (lines.length === 1) {
            return reasonText
        }

        return (
            <ul className="list-disc space-y-1 pl-4">
                {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                ))}
            </ul>
        )
    }, [reason])

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />
            <Card position="single">
                <PaymentInfoRow label="Rejected on" value={rejectedOn} />

                <CountryRegionRow countryCode={countryCode} isBridge={isBridge} />

                <PaymentInfoRow label="Reason" value={formattedReason} hideBottomBorder />
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
