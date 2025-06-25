import ActionModal from '@/components/Global/ActionModal'
import { useKycFlow } from '@/hooks/useKycFlow'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { KycVerificationInProgressModal } from './KycVerificationInProgressModal'
import { IconName } from '@/components/Global/Icons/Icon'

interface KycModalFlowProps {
    isOpen: boolean
    onClose: () => void
    onKycSuccess?: () => void
}

export const InitiateKYCModal = ({ isOpen, onClose, onKycSuccess }: KycModalFlowProps) => {
    const {
        isLoading,
        error,
        iframeOptions,
        isVerificationProgressModalOpen,
        handleInitiateKyc,
        handleIframeClose,
        closeVerificationProgressModal,
    } = useKycFlow({ onKycSuccess })

    const handleVerifyClick = async () => {
        const result = await handleInitiateKyc()
        if (result?.success) {
            onClose()
        }
    }

    return (
        <>
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                title="Verify your identity first"
                description="To continue, you need to complete identity verification. This usually takes just a few minutes."
                icon={'badge' as IconName}
                ctas={[
                    {
                        text: isLoading ? 'Loading...' : 'Verify now',
                        onClick: handleVerifyClick,
                        variant: 'purple',
                        disabled: isLoading,
                        shadowSize: '4',
                        icon: 'check-circle',
                        className: 'h-11',
                    },
                    {
                        hidden: !error,
                        text: error ?? 'Retry',
                        onClick: onClose,
                        variant: 'transparent',
                        className: 'underline text-sm !font-normal w-full !transform-none !pt-2 text-error-3',
                    },
                ]}
            />
            <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />
            <KycVerificationInProgressModal
                isOpen={isVerificationProgressModalOpen}
                onClose={closeVerificationProgressModal}
            />
        </>
    )
}
