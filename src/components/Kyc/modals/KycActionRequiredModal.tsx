import ActionModal from '@/components/Global/ActionModal'
import { RejectLabelsList } from '../RejectLabelsList'

interface KycActionRequiredModalProps {
    visible: boolean
    onClose: () => void
    onResubmit: () => void
    isLoading?: boolean
    rejectLabels?: string[] | null
}

// shown when user clicks a locked region while their kyc needs resubmission (soft reject)
export const KycActionRequiredModal = ({
    visible,
    onClose,
    onResubmit,
    isLoading,
    rejectLabels,
}: KycActionRequiredModalProps) => {
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-1"
            title="One more step"
            description="We need a bit more from you to confirm your ID."
            content={
                <div className="w-full">
                    <RejectLabelsList rejectLabels={rejectLabels} />
                </div>
            }
            ctas={[
                {
                    text: isLoading ? 'Loading...' : 'Continue',
                    icon: 'retry',
                    onClick: onResubmit,
                    disabled: isLoading,
                    shadowSize: '4',
                },
            ]}
        />
    )
}
