import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { KycRestartCooldownModal } from './KycRestartCooldownModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'

interface SumsubKycModalsProps {
    flow: ReturnType<typeof useMultiPhaseKycFlow>
    onCooldownClose?: () => void
}

/**
 * shared modal rendering for the multi-phase kyc flow.
 * renders the sumsub SDK wrapper, the multi-phase verification modal,
 * and the bridge ToS iframe.
 *
 * pair with useMultiPhaseKycFlow hook for the logic.
 */
export const SumsubKycModals = ({ flow, onCooldownClose }: SumsubKycModalsProps) => {
    const t = useTranslations('kyc.correction')
    return (
        <>
            <ActionModal
                visible={flow.showCorrection === true}
                onClose={flow.dismissCorrection}
                title={t('title')}
                description={flow.verificationSession?.reasonCode === 'INVALID_TAX_ID' ? t('taxId') : t('details')}
                tone="warning"
                ctas={[{ text: t('correct'), variant: 'purple', onClick: flow.correctVerificationData }]}
            />
            <KycRestartCooldownModal
                cooldown={flow.errorCooldown}
                onClose={() => {
                    onCooldownClose?.()
                    flow.dismissErrorCooldown()
                }}
            />
            <SumsubKycWrapper
                sessionKey={
                    flow.verificationSession
                        ? `${flow.verificationSession.id}:${flow.verificationSession.generation}`
                        : undefined
                }
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleSdkClose}
                onComplete={flow.handleSdkComplete}
                onSubmitted={flow.handleSdkSubmitted}
                onRefreshToken={flow.refreshToken}
                isMultiLevel={flow.isMultiLevel}
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
                preparingStage={flow.preparingStage}
            />

            {flow.tosLink && (
                <IframeWrapper src={flow.tosLink} visible={flow.showTosIframe} onClose={flow.handleTosIframeClose} />
            )}
        </>
    )
}
