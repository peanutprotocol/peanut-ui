import ActionModal from '@/components/Global/ActionModal'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

export const ResidenceReviewModal = ({ onClose }: { onClose: () => void }) => {
    const residence = useTranslations('profile.unlockPayments.changeModal')
    const common = useTranslations('common')
    const modals = useModalsContextOptional()
    return (
        <ActionModal
            visible
            onClose={onClose}
            title={residence('reviewTitle')}
            description={residence('reviewBody')}
            tone="info"
            footer={
                modals && (
                    <LinkButton
                        onClick={() => {
                            onClose()
                            modals.setIsSupportModalOpen(true)
                        }}
                    >
                        {common('contactSupport')}
                    </LinkButton>
                )
            }
        />
    )
}
