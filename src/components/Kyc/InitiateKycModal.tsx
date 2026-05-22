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
    variant?: 'default' | 'provider_rejection' | 'blocked' | 'cross_region' | 'processing'
    providerTitle?: string
    providerMessage?: string
    providerActionLabel?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
}

// confirmation modal shown before starting KYC or provider resubmission.
// for fresh KYC: "Verify your identity"
// for provider rejections: provider-specific copy when available
// for blocked: provider payment setup issue — contact support
// for cross-region: "Your identity is verified, submit a local ID"
export const InitiateKycModal = ({
    visible,
    onClose,
    onVerify,
    onContactSupport,
    isLoading,
    error,
    variant = 'default',
    providerTitle,
    providerMessage,
    providerActionLabel,
    regionName,
}: InitiateKycModalProps) => {
    const isProviderRejection = variant === 'provider_rejection'
    const isBlocked = variant === 'blocked'
    const isCrossRegion = variant === 'cross_region'
    const isProcessing = variant === 'processing'

    const getTitle = () => {
        if (error) return 'Something went wrong'
        if (isProcessing) return 'Document review in progress'
        if (isBlocked) return 'Payment setup issue'
        if (isProviderRejection) return providerTitle || 'We need more details'
        if (isCrossRegion) return 'Submit local ID'
        return 'Verify your identity'
    }

    const getDescription = () => {
        if (error) return `${error} Please contact support for assistance.`
        if (isProcessing)
            return (
                providerMessage ||
                "We're reviewing your documents. We'll update your payment setup when the review is complete."
            )
        if (isBlocked)
            return (
                providerMessage || "We couldn't enable payments for this region. Please contact support for assistance."
            )
        if (isProviderRejection) return providerMessage || 'Please upload a clearer photo of your ID to continue.'
        if (isCrossRegion) {
            const region = regionName ? ` from ${regionName}` : ''
            return `Your identity is already verified. To enable payments in this region, we need a valid ID${region}.`
        }
        return 'To continue, you need to complete identity verification. This usually takes just a few minutes.'
    }

    const getCta = () => {
        if (isProcessing) {
            return {
                text: 'Got it',
                onClick: onClose,
            }
        }
        if (error || isBlocked) {
            return {
                text: 'Contact support',
                onClick: onContactSupport ?? onClose,
            }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? 'Loading...' : providerActionLabel || 'Provide details',
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        if (isCrossRegion) {
            return {
                text: isLoading ? 'Loading...' : 'Submit document',
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
            icon={(error || isBlocked ? 'alert' : isProcessing ? 'clock' : 'badge') as IconName}
            iconContainerClassName={isBlocked ? 'bg-error-1' : ''}
            iconProps={isBlocked ? { className: 'text-error' } : undefined}
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
                isProviderRejection || isBlocked || isProcessing ? undefined : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
        />
    )
}
