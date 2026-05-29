import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { formatDate } from '@/utils/general.utils'

// this component shows the identity-verification status when it's failed/rejected.
// reads the provider-agnostic identity fields: a friendly actionMessage + normalized
// reject labels. No provider names.
export const KycFailed = ({
    actionMessage,
    rejectLabels,
    reviewedAt,
    onRetry,
    isLoading,
}: {
    actionMessage?: string
    rejectLabels?: string[] | null
    reviewedAt?: string
    onRetry: () => void
    isLoading?: boolean
}) => {
    const rejectedOn = useMemo(() => {
        if (!reviewedAt) return 'N/A'
        try {
            return formatDate(new Date(reviewedAt))
        } catch (error) {
            console.error('failed to parse reviewedAt date:', error)
            return 'N/A'
        }
    }, [reviewedAt])

    const hasReason = !!actionMessage

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />

            <Card position="single" className="py-0">
                <PaymentInfoRow label="Rejected on" value={rejectedOn} hideBottomBorder={!hasReason} />
                {hasReason && <PaymentInfoRow label="Reason" value={actionMessage} hideBottomBorder />}
            </Card>

            <RejectLabelsList rejectLabels={rejectLabels} />

            <Button
                icon="retry"
                variant="purple"
                className="w-full"
                shadowSize="4"
                onClick={() => onRetry()}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Retry verification'}
            </Button>
        </div>
    )
}
