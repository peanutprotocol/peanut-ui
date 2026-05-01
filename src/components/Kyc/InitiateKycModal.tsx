import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface InitiateKycModalProps {
    visible: boolean
    onClose: () => void
    onVerify: () => void
    isLoading?: boolean
    /** when set, shows provider-specific messaging instead of generic "verify your identity" */
    variant?: 'default' | 'provider_rejection' | 'cross_region'
    providerMessage?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
}

// confirmation modal shown before starting KYC or provider resubmission.
// for fresh KYC: "Verify your identity"
// for provider rejections: "We need extra documents"
// for cross-region: "Your identity is verified, we need a local ID"
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    isLoading,
    variant = 'default',
    providerMessage,
    regionName,
}: InitiateKycModalProps) => {
    const isProviderRejection = variant === 'provider_rejection'
    const isCrossRegion = variant === 'cross_region'

    const getDescription = () => {
        if (isProviderRejection) return providerMessage || 'Please upload a clearer photo of your ID to continue.'
        if (isCrossRegion) {
            const region = regionName ? ` from ${regionName}` : ''
            return `Your identity is already verified. To enable payments in this region, we need a valid ID${region}.`
        }
        return 'To continue, you need to complete identity verification. This usually takes just a few minutes.'
    }

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={isProviderRejection ? 'We need extra documents' : 'Verify your identity'}
            description={getDescription()}
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
