import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'

interface KycProcessingModalProps {
    visible: boolean
    onClose: () => void
}

// shown when user clicks a locked region while their kyc is pending/in review
export const KycProcessingModal = ({ visible, onClose }: KycProcessingModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="clock"
            iconContainerClassName="bg-yellow-1"
            title={t('processingTitle')}
            description={t('processingDescription')}
            ctas={[
                {
                    text: tCommon('gotIt'),
                    onClick: onClose,
                    shadowSize: '4',
                },
            ]}
        />
    )
}
