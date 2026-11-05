import { useCallback } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import { KycRestartCooldownModal } from './KycRestartCooldownModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { KycFailedModal } from '@/components/Kyc/modals/KycFailedModal'
import IframeWrapper, { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import { type useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { KycControlFlowProvider, useKycControl } from '@/features/paperwork-verification/analytics'

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
    const controlFlow = flow.isProviderRequest ? 'kyc_provider_request' : 'kyc_legacy'
    const { track } = useKycControl('correction', controlFlow)
    const tos = useKycControl('tos', controlFlow)
    const { handleTosIframeClose } = flow
    const closeTosPage = useCallback(
        (source: IframeCloseSource = 'manual') => {
            if (source === 'manual') tos.track('tos_page', 'dismiss')
            return handleTosIframeClose(source)
        },
        [tos, handleTosIframeClose]
    )
    const t = useTranslations('kyc.correction')
    return (
        <KycControlFlowProvider value={controlFlow}>
            <ActionModal
                visible={flow.showCorrection === true}
                onClose={() => {
                    track('correction', 'dismiss')
                    flow.dismissCorrection()
                }}
                title={t('title')}
                description={flow.verificationSession?.reasonCode === 'INVALID_TAX_ID' ? t('taxId') : t('details')}
                tone="attention"
                ctas={[
                    {
                        text: t('correct'),
                        variant: 'primary',
                        onClick: () => {
                            track('correct_data', 'tap')
                            flow.correctVerificationData()
                        },
                    },
                ]}
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
                validationError={flow.taxIdCorrection ? t('taxId') : undefined}
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
                onStartSupplement={() => void flow.handleStartSupplement()}
                onSkipSupplement={flow.handleSkipSupplement}
                onContinue={flow.completeFlow}
                tosError={flow.tosError}
                isLoadingTos={flow.isLoadingTos}
                preparingTimedOut={flow.preparingTimedOut}
                preparingStage={flow.preparingStage}
                completionNotice={flow.completionNotice}
            />

            {flow.tosLink && <IframeWrapper src={flow.tosLink} visible={flow.showTosIframe} onClose={closeTosPage} />}

            {flow.showVerificationReview && (
                <KycFailedModal
                    visible
                    isTerminal
                    onClose={flow.dismissVerificationReview}
                    onRetry={flow.dismissVerificationReview}
                />
            )}
        </KycControlFlowProvider>
    )
}
