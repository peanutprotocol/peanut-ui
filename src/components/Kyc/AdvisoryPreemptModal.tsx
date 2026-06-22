import ActionModal from '@/components/Global/ActionModal'

interface AdvisoryPreemptModalProps {
    visible: boolean
    /** ISO date the requirement becomes blocking; drives the deadline copy. */
    effectiveDate?: string
    isLoading?: boolean
    /** Launch the verification flow early. */
    onCompleteNow: () => void
    /** Dismiss and continue with what the user was doing. */
    onSkip: () => void
    onClose: () => void
}

function formatEffectiveDate(iso?: string): string | null {
    if (!iso) return null
    const date = new Date(iso)
    // `iso` is a date-only YYYY-MM-DD, so `new Date()` parses it at UTC midnight.
    // Format in UTC too, or Americas timezones render the day before the deadline.
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Skippable pre-empt for a future-dated verification requirement on a rail that
 * still works today (the gate's `ready` + `advisory`). "Complete now" launches
 * the verification early; "Not now" lets the user carry on and resolve it later.
 * Once the effective date passes the backend reclassifies the requirement to
 * blocking and the non-skippable InitiateKycModal takes over — there is no FE
 * cutover logic here.
 */
export default function AdvisoryPreemptModal({
    visible,
    effectiveDate,
    isLoading = false,
    onCompleteNow,
    onSkip,
    onClose,
}: AdvisoryPreemptModalProps) {
    const formatted = formatEffectiveDate(effectiveDate)
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="badge"
            title="One quick step coming up"
            description={
                formatted
                    ? `To keep using bank transfers, you'll need to complete a short verification by ${formatted}. Take care of it now so nothing pauses later.`
                    : `To keep using bank transfers, you'll need to complete a short verification soon. Take care of it now so nothing pauses later.`
            }
            ctas={[
                {
                    text: 'Complete now',
                    onClick: onCompleteNow,
                    variant: 'purple',
                    shadowSize: '4',
                    disabled: isLoading,
                },
                { text: 'Not now', onClick: onSkip, variant: 'stroke', disabled: isLoading },
            ]}
        />
    )
}
