import ActionModal from '@/components/Global/ActionModal'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import { KycRestartCooldownModal } from './KycRestartCooldownModal'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { KycVerificationInProgressModal } from '@/components/Kyc/KycVerificationInProgressModal'
import { OneShotCardStep } from '@/components/Kyc/OneShotCardStep'
import { OneShotSetupDrawer } from '@/components/Kyc/OneShotSetupDrawer'
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
    const router = useRouter()
    const { setIsSupportModalOpen } = useModalsContext()
    const { oneShotCard } = flow
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

            {/* one-shot onboarding (TASK-23329): the setup rows stand in for the phase modals */}
            {flow.oneShotSetup ? (
                <>
                    {/* an SDK session or the card agreements take the screen; the drawer returns after them */}
                    <OneShotSetupDrawer
                        open={flow.isModalOpen && !oneShotCard.isForeground && !flow.showWrapper}
                        residence={flow.oneShotSetup.residence}
                        rows={flow.oneShotSetup.rows}
                        retake={flow.oneShotRetake}
                        cardError={oneShotCard.chain?.kind === 'error' ? oneShotCard.chain.message : null}
                        onClose={flow.handleModalClose}
                        onContinue={flow.completeFlow}
                        // a retry on the same level: POST /users/identity answers a token for it
                        onRetake={() => void flow.handleInitiateKyc()}
                        onVerifyAgain={() => void flow.handleRestartIdentity()}
                        onUploadDocument={(step) => {
                            // the card page owns the card's own document upload (proof of address)
                            if (step.provider === 'rain') return router.push('/card')
                            void flow.handleFixableGate(step.provider === 'bridge' ? 'BRIDGE' : 'MANTECA', {
                                actionKey: step.action?.key,
                                reason: step.reasonCode ? { code: step.reasonCode } : undefined,
                            })
                        }}
                        onResumeCard={() => void oneShotCard.resume()}
                        onRetryCard={() => void oneShotCard.start()}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                    />
                    <OneShotCardStep step={oneShotCard} />
                </>
            ) : (
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
            )}

            {flow.tosLink && (
                <IframeWrapper src={flow.tosLink} visible={flow.showTosIframe} onClose={flow.handleTosIframeClose} />
            )}
        </>
    )
}
