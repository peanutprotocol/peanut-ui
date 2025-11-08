import ActionModal from '@/components/Global/ActionModal'
import { useBridgeKycFlow } from '@/hooks/useBridgeKycFlow'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { KycVerificationInProgressModal } from './KycVerificationInProgressModal'
import CameraPermissionWarningModal from './CameraPermissionWarningModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { saveRedirectUrl } from '@/utils'
import useClaimLink from '../Claim/useClaimLink'
import { useKycCameraCheck } from '@/hooks/useKycCameraCheck'

interface BridgeKycModalFlowProps {
    isOpen: boolean
    onClose: () => void
    onKycSuccess?: () => void
    onManualClose?: () => void
    flow?: 'add' | 'withdraw' | 'request_fulfillment'
}

export const InitiateBridgeKYCModal = ({
    isOpen,
    onClose,
    onKycSuccess,
    onManualClose,
    flow,
}: BridgeKycModalFlowProps) => {
    const {
        isLoading,
        error,
        iframeOptions,
        isVerificationProgressModalOpen,
        handleInitiateKyc,
        handleIframeClose,
        closeVerificationProgressModal,
    } = useBridgeKycFlow({ onKycSuccess, flow, onManualClose })
    const { addParamStep } = useClaimLink()

    const { showCameraWarning, mediaCheckResult, handleVerifyClick: checkAndInitiate, handleContinueAnyway, handleOpenInBrowser } = useKycCameraCheck({
        onInitiateKyc: handleInitiateKyc,
        onClose,
        saveRedirect: saveRedirectUrl,
    })

    const handleVerifyClick = async () => {
        addParamStep('bank')
        const result = await checkAndInitiate()
        if (result?.shouldProceed) {
            saveRedirectUrl()
            onClose()
        }
    }

    return (
        <>
            <ActionModal
                visible={isOpen && !showCameraWarning}
                onClose={onManualClose ? onManualClose : onClose}
                title="Verify your identity first"
                description="To continue, you need to complete identity verification. This usually takes just a few minutes."
                icon={'badge' as IconName}
                modalPanelClassName="max-w-full m-2"
                ctaClassName="grid grid-cols-1 gap-3"
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
                        className:
                            'underline text-xs md:text-sm !font-normal w-full !transform-none !pt-2 text-error-3 px-0',
                    },
                ]}
            />

            {mediaCheckResult && (
                <CameraPermissionWarningModal
                    visible={showCameraWarning}
                    onClose={() => setShowCameraWarning(false)}
                    onContinueAnyway={handleContinueAnyway}
                    onOpenInBrowser={handleOpenInBrowser}
                    mediaCheckResult={mediaCheckResult}
                />
            )}

            <IframeWrapper {...iframeOptions} visible={iframeOptions.visible && !showCameraWarning} onClose={handleIframeClose} />
            <KycVerificationInProgressModal
                isOpen={isVerificationProgressModalOpen}
                onClose={closeVerificationProgressModal}
            />
        </>
    )
}
