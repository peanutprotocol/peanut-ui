import { useFormatter, useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'

interface AdvisoryPreemptModalProps {
    visible: boolean
    /** ISO date the requirement becomes blocking; drives the deadline copy. */
    effectiveDate?: string
    isLoading?: boolean
    /** Launch the verification flow. */
    onCompleteNow: () => void
}

/**
 * Mandatory pre-empt for a pending Bridge verification requirement on the bank
 * rails. Non-closable and non-skippable: the user must complete the verification
 * before they can continue with a bank transfer. There is no "Not now" / X /
 * backdrop dismiss — the only way forward is "Complete now".
 */
export default function AdvisoryPreemptModal({
    visible,
    effectiveDate,
    isLoading = false,
    onCompleteNow,
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
            // Hard gate: no dismiss. onClose is required by ActionModal but
            // `preventClose` blocks backdrop/escape and `hideModalCloseButton`
            // removes the X, so it is never reachable.
            onClose={() => {}}
            preventClose
            hideModalCloseButton
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
            ]}
        />
    )
}
