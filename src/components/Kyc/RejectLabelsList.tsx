import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import InfoCard from '@/components/Global/InfoCard'
import { rejectLabelCode } from '@/constants/sumsub-reject-labels.consts'

// renders sumsub reject labels as individual InfoCards, with a generic fallback
// when no labels are provided. shared between drawer states and modals.
export const RejectLabelsList = ({ rejectLabels }: { rejectLabels?: string[] | null }) => {
    const t = useTranslations('kyc')
    const labels = rejectLabels?.length ? rejectLabels : null

    const reasons = useMemo(() => {
        if (!labels) return null
        // rejectLabelCode() collapses any label we have no copy for onto
        // FALLBACK, so an unrecognised sumsub code can never render a key path.
        return labels.map((label) => {
            const code = rejectLabelCode(label)
            return {
                title: t(`rejectLabels.${code}.title`),
                description: t(`rejectLabels.${code}.description`),
            }
        })
    }, [labels, t])

    if (!reasons) {
        return <InfoCard variant="info" icon="alert" description={t('rejectLabelsFallbackDescription')} />
    }

    return (
        <div className="space-y-2">
            {reasons.map((reason, i) => (
                <InfoCard key={i} variant="info" icon="alert" title={reason.title} description={reason.description} />
            ))}
        </div>
    )
}
