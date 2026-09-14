import { useTranslations } from 'next-intl'
import { RejectLabelsList } from './RejectLabelsList'
import { Notification } from '@/components/0_Bruddle/Notification'

interface KycFailedContentProps {
    rejectLabels?: string[] | null
    isTerminal: boolean
}

// shared rejection details — used by both KycFailed (drawer) and KycFailedModal.
// renders reject labels (non-terminal) or terminal error info card.
export const KycFailedContent = ({ rejectLabels, isTerminal }: KycFailedContentProps) => {
    const t = useTranslations('kyc')

    if (isTerminal) {
        return <Notification priority="error">{t('terminalDescription')}</Notification>
    }

    return <RejectLabelsList rejectLabels={rejectLabels} />
}
