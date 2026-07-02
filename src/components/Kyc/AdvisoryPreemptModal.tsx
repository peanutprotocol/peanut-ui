import ActionModal from '@/components/Global/ActionModal'

interface AdvisoryPreemptModalProps {
    visible: boolean
    /** ISO date the requirement becomes blocking; drives the deadline copy. */
    effectiveDate?: string
    isLoading?: boolean
    /** Launch the verification flow. */
    onCompleteNow: () => void
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
    const formatted = formatEffectiveDate(effectiveDate)
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
            title="One quick step to continue"
            description={
                formatted
                    ? `To continue using bank transfers, please complete a short verification (required by ${formatted}). It only takes a couple of minutes.`
                    : `To continue using bank transfers, please complete a short verification. It only takes a couple of minutes.`
            }
            ctas={[
                {
                    text: 'Complete now',
                    onClick: onCompleteNow,
                    variant: 'purple',
                    shadowSize: '4',
                    disabled: isLoading,
                },
            ]}
        />
    )
}
