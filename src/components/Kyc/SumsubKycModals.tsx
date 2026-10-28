import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { KycRestartCooldownModal } from './KycRestartCooldownModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { KycSetupStatusDrawer } from '@/components/Kyc/KycSetupStatusDrawer'
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
                tone="attention"
                ctas={[{ text: t('correct'), variant: 'primary', onClick: flow.correctVerificationData }]}
            />
            <KycRestartCooldownModal
                cooldown={flow.errorCooldown}
                onClose={() => {
                    onCooldownClose?.()
                    flow.dismissErrorCooldown()
                }}
            />
            <SumsubKycWrapper
                documentConfig={flow.documentConfig}
                sessionKey={
                    flow.documentAttemptId ??
                    (flow.verificationSession
                        ? `${flow.verificationSession.id}:${flow.verificationSession.generation}`
                        : undefined)
                }
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleSdkClose}
                onComplete={flow.handleSdkComplete}
                onSubmitted={flow.handleSdkSubmitted}
                onRefreshToken={flow.refreshToken}
                isMultiLevel={flow.isMultiLevel}
            />

            {flow.setupStatus ? (
                <>
                    <KycSetupStatusDrawer
                        open={flow.setupStatus.open}
                        residence={flow.setupStatus.residence}
                        rows={flow.setupStatus.rows}
                        error={flow.error}
                        busy={flow.isLoading}
                        onClose={flow.handleModalClose}
                        onContinue={flow.completeFlow}
                        onUploadDocument={(step) => void flow.handleSetupDocument(step)}
                        onReviewTerms={flow.handleSetupTerms}
                        onVerifyAgain={() => void flow.handleSetupRestart()}
                    />
                    {/* the existing terms step, which names and links Bridge's documents */}
                    <KycVerificationInProgressModal
                        isOpen={flow.isModalOpen && flow.modalPhase === 'bridge_tos'}
                        onClose={flow.handleSetupBack}
                        phase="bridge_tos"
                        onAcceptTerms={flow.handleAcceptTerms}
                        tosError={flow.tosError}
                        isLoadingTos={flow.isLoadingTos}
                    />
                </>
            ) : (
                <KycVerificationInProgressModal
                    isOpen={flow.isModalOpen}
                    onClose={flow.handleModalClose}
                    phase={flow.modalPhase}
                    onAcceptTerms={flow.handleAcceptTerms}
                    onSkipTerms={flow.handleSkipTerms}
                    onStartSupplement={() => void flow.handleStartSupplement()}
                    onSkipSupplement={flow.handleSkipSupplement}
                    onContinue={flow.completeFlow}
                    tosError={flow.tosError}
                    isLoadingTos={flow.isLoadingTos}
                    preparingTimedOut={flow.preparingTimedOut}
                    preparingStage={flow.preparingStage}
                />
            )}

            {flow.tosLink && (
                <IframeWrapper src={flow.tosLink} visible={flow.showTosIframe} onClose={flow.handleTosIframeClose} />
            )}
        </>
    )
}
