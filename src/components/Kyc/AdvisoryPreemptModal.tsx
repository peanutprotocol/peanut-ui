import { useFormatter, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'

interface AdvisoryPreemptModalProps {
    visible: boolean
    /** ISO date the requirement becomes blocking; drives the deadline copy. */
    effectiveDate?: string
    isLoading?: boolean
    /** Launch the verification flow. */
    onCompleteNow: () => void
    /** Continue with the transfer without completing the requirement now. */
    onDoLater: () => void
    /** Plain dismiss (X / backdrop): close without proceeding anywhere. */
    onClose: () => void
}

/**
 * Pre-empt for a pending Bridge verification requirement on the bank rails.
 * The rail is still ENABLED until the effective date, so the honest shape is
 * an informed choice, not a trap: "Complete now" launches the verification,
 * "Do this later" is a real button that continues the transfer, and the
 * deadline (when known) says exactly when later stops being an option.
 */
export default function AdvisoryPreemptModal({
    visible,
    effectiveDate,
    isLoading = false,
    onCompleteNow,
    onDoLater,
    onClose,
}: AdvisoryPreemptModalProps) {
    const t = useTranslations('kyc')
    const format = useFormatter()

    const parsed = effectiveDate ? new Date(effectiveDate) : null
    const formatted =
        parsed && !Number.isNaN(parsed.getTime())
            ? // `effectiveDate` is a date-only YYYY-MM-DD, so it parses at UTC
              // midnight. Format in UTC too, or Americas timezones render the
              // day before the deadline.
              format.dateTime(parsed, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
            : null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="badge"
            title={t('advisory.title')}
            description={
                formatted ? t('advisory.descriptionByDate', { deadline: formatted }) : t('advisory.description')
            }
            ctas={[
                {
                    text: t('advisory.completeNow'),
                    onClick: onCompleteNow,
                    variant: 'purple',
                    shadowSize: '4',
                    disabled: isLoading,
                },
                {
                    text: t('advisory.doLater'),
                    onClick: onDoLater,
                    variant: 'stroke',
                    disabled: isLoading,
                },
            ]}
        />
    )
}
