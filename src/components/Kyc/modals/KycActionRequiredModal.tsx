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
            title="Action needed"
            description="We need more information to verify your identity."
            content={
                <div className="w-full">
                    <RejectLabelsList rejectLabels={rejectLabels} />
                </div>
            }
            ctas={[
                {
                    text: isLoading ? 'Loading...' : 'Re-submit verification',
                    icon: 'retry',
                    onClick: onResubmit,
                    disabled: isLoading,
                    shadowSize: '4',
                },
            ]}
        />
    )
}
