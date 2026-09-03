import { Button } from '@/components/0_Bruddle/Button'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { KycFailedContent } from '../KycFailedContent'
import Card from '@/components/Global/Card'
import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

// this component shows the identity-verification status when it's failed/rejected.
//
// `isTerminal` decides the ending, and getting it wrong is user-visible in both
// directions. Terminal (fraud, sanctions, age, forgery) means the decision is
// made: no retry — it cannot pass — and no reject labels, because naming the
// cause carries compliance exposure and tips off the people it describes.
// Support IS offered there, because a human can review a misclassification.
// Non-terminal means our check errored, so a retry is genuinely worth offering.
//
// reads the provider-agnostic identity fields + normalized reject labels. The
// backend's actionMessage is a pure function of status, so its presence gates the
// reason row while the copy itself comes from the catalog. No provider names.
type KycFailedProps = {
    actionMessage?: string
    rejectLabels?: string[] | null
    reviewedAt?: string
    onRetry: () => void
    isLoading?: boolean
} & (
    | {
          // A terminal render drops the retry button, so "Contact support" is the
          // only action left — the type forces the container to wire it up.
          isTerminal: true
          onContactSupport: () => void
      }
    | {
          isTerminal?: false
          onContactSupport?: () => void
      }
)

export const KycFailed = ({
    actionMessage,
    rejectLabels,
    reviewedAt,
    onRetry,
    isLoading,
    isTerminal = false,
    onContactSupport,
}: KycFailedProps) => {
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
                {hasReason && <PaymentInfoRow label={t('reason')} value={t('actionMessageFailed')} hideBottomBorder />}
            </Card>

            <KycFailedContent rejectLabels={rejectLabels} isTerminal={isTerminal} />

            {isTerminal ? (
                <Button variant="purple" className="w-full" shadowSize="4" onClick={() => onContactSupport?.()}>
                    {tCommon('contactSupport')}
                </Button>
            ) : (
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
            )}
        </div>
    )
}
