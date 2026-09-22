import { useTranslations } from 'next-intl'
import { RejectLabelsList } from './RejectLabelsList'
import { Callout } from '@/components/0_Bruddle/Callout'

interface KycFailedContentProps {
    rejectLabels?: string[] | null
    isTerminal: boolean
}

// shared rejection details — used by both KycFailed (drawer) and KycFailedModal.
// renders reject labels (non-terminal) or terminal error info card.
export const KycFailedContent = ({ rejectLabels, isTerminal }: KycFailedContentProps) => {
    const t = useTranslations('kyc')

    if (isTerminal) {
        return <Callout priority="error">{t('terminalDescription')}</Callout>
    }

    return <RejectLabelsList rejectLabels={rejectLabels} />
}
