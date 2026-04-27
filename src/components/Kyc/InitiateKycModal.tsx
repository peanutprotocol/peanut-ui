import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface InitiateKycModalProps {
    visible: boolean
    onClose: () => void
    onVerify: () => void
    isLoading?: boolean
    /** when set, shows provider-specific messaging instead of generic "verify your identity" */
    variant?: 'default' | 'provider_rejection'
    providerMessage?: string
}

// confirmation modal shown before starting KYC or provider resubmission.
// for fresh KYC: "Verify your identity" — for provider rejections: "We need extra documents"
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    isLoading,
    variant = 'default',
    providerMessage,
}: InitiateKycModalProps) => {
    const isProviderRejection = variant === 'provider_rejection'

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={isProviderRejection ? 'We need extra documents' : 'Verify your identity'}
            description={
                isProviderRejection
                    ? providerMessage || 'Please upload a clearer photo of your ID to continue.'
                    : 'To continue, you need to complete identity verification. This usually takes just a few minutes.'
            }
            icon={'badge' as IconName}
            modalPanelClassName="max-w-full m-2"
            ctaClassName="grid grid-cols-1 gap-3"
            ctas={[
                {
                    text: isLoading ? 'Loading...' : isProviderRejection ? 'Upload document' : 'Start Verification',
                    onClick: onVerify,
                    variant: 'purple',
                    disabled: isLoading,
                    shadowSize: '4',
                    icon: isProviderRejection ? 'upload' : 'check-circle',
                    className: 'h-11',
                },
            ]}
            footer={
                isProviderRejection ? undefined : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
        />
    )
}
