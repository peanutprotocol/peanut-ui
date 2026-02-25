import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface InitiateKycModalProps {
    visible: boolean
    onClose: () => void
    onVerify: () => void
    isLoading?: boolean
}

// confirmation modal shown before starting KYC.
// user must click "Start Verification" to proceed to the sumsub SDK.
export const InitiateKycModal = ({ visible, onClose, onVerify, isLoading }: InitiateKycModalProps) => {
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title="Verify your identity"
            description="To continue, you need to complete identity verification. This usually takes just a few minutes."
            icon={'badge' as IconName}
            modalPanelClassName="max-w-full m-2"
            ctaClassName="grid grid-cols-1 gap-3"
            ctas={[
                {
                    text: isLoading ? 'Loading...' : 'Start Verification',
                    onClick: onVerify,
                    variant: 'purple',
                    disabled: isLoading,
                    shadowSize: '4',
                    icon: 'check-circle',
                    className: 'h-11',
                },
            ]}
            footer={<PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />}
        />
    )
}
