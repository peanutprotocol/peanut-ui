import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { FALLBACK_REJECT_LABEL_CODE, rejectLabelCode } from '@/constants/sumsub-reject-labels.consts'
import { REJECT_LABEL_ACTIONS } from '@/constants/sumsub-reject-actions.consts'

// A cause only support can review is never named: it reads as an accusation and tips off the people it describes.
const nameable = (label: string) => {
    const code = rejectLabelCode(label)
    return code === FALLBACK_REJECT_LABEL_CODE || REJECT_LABEL_ACTIONS[code] !== 'contact_support'
}

// renders sumsub reject labels as individual notifications, with a generic fallback
// when no labels are provided. shared between drawer states and modals.
export const RejectLabelsList = ({ rejectLabels }: { rejectLabels?: string[] | null }) => {
    const t = useTranslations('kyc')
    const named = rejectLabels?.filter(nameable)
    const labels = named?.length ? named : null

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
        return <Callout priority="error">{t('rejectLabelsFallbackDescription')}</Callout>
    }

    return (
        <div className="space-y-2">
            {reasons.map((reason, i) => (
                <Callout key={i} priority="error" title={reason.title}>
                    {reason.description}
                </Callout>
            ))}
        </div>
    )
}
