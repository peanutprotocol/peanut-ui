import { useMemo } from 'react'
import InfoCard from '@/components/Global/InfoCard'
import { getRejectLabelInfo } from '@/constants/sumsub-reject-labels.consts'

// renders sumsub reject labels as individual InfoCards, with a generic fallback
// when no labels are provided. shared between drawer states and modals.
export const RejectLabelsList = ({ rejectLabels }: { rejectLabels?: string[] | null }) => {
    const labels = rejectLabels?.length ? rejectLabels : null

    const reasons = useMemo(() => {
        if (!labels) return null
        return labels.map((label) => getRejectLabelInfo(label))
    }, [labels])

    if (!reasons) {
        return (
            <InfoCard
                variant="info"
                icon="alert"
                description="We need more information to complete your verification. Please provide the requested details to continue."
            />
        )
    }

    return (
        <div className="space-y-2">
            {reasons.map((reason, i) => (
                <InfoCard key={i} variant="info" icon="alert" title={reason.title} description={reason.description} />
            ))}
        </div>
    )
}
