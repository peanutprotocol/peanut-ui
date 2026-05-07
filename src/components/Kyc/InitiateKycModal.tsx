import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface InitiateKycModalProps {
    visible: boolean
    onClose: () => void
    onVerify: () => void
    onContactSupport?: () => void
    isLoading?: boolean
    /** error message from a failed verify/resubmit attempt */
    error?: string | null
    /** when set, shows provider-specific messaging instead of generic "verify your identity" */
    variant?: 'default' | 'provider_rejection' | 'blocked' | 'cross_region'
    providerMessage?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
}

// confirmation modal shown before starting KYC or provider resubmission.
// for fresh KYC: "Verify your identity"
// for provider rejections: "We need extra documents"
// for blocked: "Verification issue — contact support"
// for cross-region: "Your identity is verified, we need a local ID"
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    onContactSupport,
    isLoading,
    error,
    variant = 'default',
    providerMessage,
    regionName,
}: InitiateKycModalProps) => {
    const isProviderRejection = variant === 'provider_rejection'
    const isBlocked = variant === 'blocked'
    const isCrossRegion = variant === 'cross_region'

    const getTitle = () => {
        if (error) return 'Something went wrong'
        if (isBlocked) return 'Verification issue'
        if (isProviderRejection) return 'We need extra documents'
        return 'Verify your identity'
    }

    const getDescription = () => {
        if (error) return `${error} Please contact support for assistance.`
        if (isBlocked)
            return providerMessage || "We couldn't verify your identity. Please contact support for assistance."
        if (isProviderRejection) return providerMessage || 'Please upload a clearer photo of your ID to continue.'
        if (isCrossRegion) {
            const region = regionName ? ` from ${regionName}` : ''
            return `Your identity is already verified. To enable payments in this region, we need a valid ID${region}.`
        }
        return 'To continue, you need to complete identity verification. This usually takes just a few minutes.'
    }

    const getCta = () => {
        if (error || isBlocked) {
            return {
                text: 'Contact support',
                onClick: onContactSupport ?? onClose,
            }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? 'Loading...' : 'Upload document',
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        return {
            text: isLoading ? 'Loading...' : 'Start Verification',
            onClick: onVerify,
            icon: 'check-circle' as IconName,
        }
    }

    const cta = getCta()

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={getTitle()}
            description={getDescription()}
            preventClose
            icon={(error || isBlocked ? 'alert' : 'badge') as IconName}
            iconContainerClassName={isBlocked ? 'bg-yellow-1' : ''}
            modalPanelClassName="max-w-full m-2"
            ctaClassName="grid grid-cols-1 gap-3"
            ctas={[
                {
                    text: cta.text,
                    onClick: cta.onClick,
                    variant: 'purple',
                    disabled: isLoading && !isBlocked,
                    shadowSize: '4',
                    ...(cta.icon ? { icon: cta.icon } : {}),
                    className: 'h-11',
                },
            ]}
            footer={
                isProviderRejection || isBlocked ? undefined : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
        />
    )
}
