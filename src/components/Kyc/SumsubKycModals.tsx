import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'

interface SumsubKycModalsProps {
    flow: ReturnType<typeof useMultiPhaseKycFlow>
    autoStartSdk?: boolean
}

/**
 * shared modal rendering for the multi-phase kyc flow.
 * renders the sumsub SDK wrapper, the multi-phase verification modal,
 * and the bridge ToS iframe.
 *
 * pair with useMultiPhaseKycFlow hook for the logic.
 */
export const SumsubKycModals = ({ flow, autoStartSdk }: SumsubKycModalsProps) => {
    return (
        <>
            <SumsubKycWrapper
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleSdkClose}
                onComplete={flow.handleSdkComplete}
                onRefreshToken={flow.refreshToken}
                autoStart={autoStartSdk}
            />

            <KycVerificationInProgressModal
                isOpen={flow.isModalOpen}
                onClose={flow.handleModalClose}
                phase={flow.modalPhase}
                onAcceptTerms={flow.handleAcceptTerms}
                onSkipTerms={flow.handleSkipTerms}
                onContinue={flow.completeFlow}
                tosError={flow.tosError}
                isLoadingTos={flow.isLoadingTos}
                preparingTimedOut={flow.preparingTimedOut}
            />

            {flow.tosLink && (
                <IframeWrapper src={flow.tosLink} visible={flow.showTosIframe} onClose={flow.handleTosIframeClose} />
            )}
        </>
    )
}
