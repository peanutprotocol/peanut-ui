import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

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
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const format = useFormatter()

    const rejectedOn = useMemo(() => {
        if (!reviewedAt) return t('notAvailable')
        try {
            const date = new Date(reviewedAt)
            if (isNaN(date.getTime())) return t('notAvailable')
            return format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
        } catch (error) {
            console.error('failed to parse reviewedAt date:', error)
            return t('notAvailable')
        }
    }, [reviewedAt, format, t])

    const hasReason = !!actionMessage

    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="failed" />

            <Card position="single" className="py-0">
                <PaymentInfoRow label={t('rejectedOn')} value={rejectedOn} hideBottomBorder={!hasReason} />
                {hasReason && <PaymentInfoRow label={t('reason')} value={actionMessage} hideBottomBorder />}
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
                {isLoading ? tCommon('loading') : t('retryVerification')}
            </Button>
        </div>
    )
}
