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
    /** when set, shows context-specific messaging instead of the generic "unlock" copy */
    variant?: 'default' | 'provider_rejection' | 'blocked' | 'restart_identity' | 'cross_region'
    providerMessage?: string
    /** country name shown in cross_region variant (e.g. "Brazil", "Argentina") */
    regionName?: string
}

// confirmation modal shown before starting identity check or document resubmission.
// default            → "Unlock your account" — verb is "unlock", ID check is the means
// provider_rejection → "We need extra documents"
// blocked            → "We couldn't unlock this — contact support"
// restart_identity   → "Verify with a different document" (self-fix for country mismatch)
// cross_region       → "Unlock {region}"
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
    const isRestartIdentity = variant === 'restart_identity'
    const isCrossRegion = variant === 'cross_region'

    const getTitle = () => {
        if (error) return 'Something went wrong'
        if (isBlocked) return 'We couldn’t unlock this'
        if (isRestartIdentity) return 'Verify with a different document'
        if (isProviderRejection) return 'We need extra documents'
        if (isCrossRegion) return regionName ? `Unlock ${regionName}` : 'Unlock this region'
        return 'Unlock your account'
    }

    const getDescription = () => {
        if (error) return `${error} Please contact support for assistance.`
        if (isBlocked) return providerMessage || "We couldn't confirm your ID. Please contact support for assistance."
        if (isRestartIdentity)
            return (
                providerMessage ||
                'This rail needs a document from a supported country. You can verify with a different ID.'
            )
        if (isProviderRejection) return providerMessage || 'Please upload a clearer photo of your ID to continue.'
        if (isCrossRegion) {
            const region = regionName ? ` in ${regionName}` : ' here'
            return `Your identity is already verified. To turn on payments${region}, we just need to confirm a few more details — about a minute.`
        }
        return 'Confirm your ID to unlock payments. Takes about a minute.'
    }

    const getCta = () => {
        if (error || isBlocked) {
            return {
                text: 'Contact support',
                onClick: onContactSupport ?? onClose,
            }
        }
        if (isRestartIdentity) {
            return {
                text: isLoading ? 'Loading...' : 'Verify with a different document',
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        if (isProviderRejection) {
            return {
                text: isLoading ? 'Loading...' : 'Upload document',
                onClick: onVerify,
                icon: 'upload' as IconName,
            }
        }
        if (isCrossRegion) {
            return {
                text: isLoading ? 'Loading...' : 'Continue',
                onClick: onVerify,
            }
        }
        return {
            text: isLoading ? 'Loading...' : 'Unlock now',
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
            icon={(error || isBlocked || isRestartIdentity ? 'alert' : 'badge') as IconName}
            iconContainerClassName={isBlocked || isRestartIdentity ? 'bg-yellow-1' : ''}
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
                isProviderRejection || isBlocked || isRestartIdentity ? undefined : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
        />
    )
}
