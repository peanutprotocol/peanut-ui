import { useTranslations } from 'next-intl'
import { RejectLabelsList } from './RejectLabelsList'
import InfoCard from '@/components/Global/InfoCard'

interface KycFailedContentProps {
    rejectLabels?: string[] | null
    isTerminal: boolean
}

// shared rejection details — used by both KycFailed (drawer) and KycFailedModal.
// renders reject labels (non-terminal) or terminal error info card.
export const KycFailedContent = ({ rejectLabels, isTerminal }: KycFailedContentProps) => {
    const t = useTranslations('kyc')

    if (isTerminal) {
        return (
            <InfoCard variant="error" icon="error" iconClassName="text-error" description={t('terminalDescription')} />
        )
    }

    return <RejectLabelsList rejectLabels={rejectLabels} />
}
