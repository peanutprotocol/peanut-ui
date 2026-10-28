import { KycActionRequired } from './states/KycActionRequired'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycRegionRestricted } from './states/KycRegionRestricted'
import { KycProcessing } from './states/KycProcessing'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PAPERWORK_VERIFICATION_FLOW } from '@/app/actions/types/kyc-workflow.types'
import { findKycSetup } from '@/app/actions/kyc-workflow'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import { useAuth } from '@/context/authContext'
import { buildSupportCaseMessage, SUPPORT_CASE_MESSAGE_KEYS } from '@/utils/contact-support.utils'
import { supportCaseOf } from '@/utils/capability-gate'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'

interface KycStatusDrawerProps {
    isOpen: boolean
    onClose: () => void
    /** keep this component mounted even after drawer closes (so SumsubKycModals persists) */
    onKeepMounted?: (keep: boolean) => void
}

// this component determines which identity-verification state to show inside the
// drawer. It reads the provider-agnostic identityVerification read-model — no
// provider names, no rail reads. Resuming/retrying launches Sumsub via the kept
// useMultiPhaseKycFlow plumbing.
export const KycStatusDrawer = ({ isOpen, onClose, onKeepMounted }: KycStatusDrawerProps) => {
    const { identity, status, isRegionRestricted, isTerminalFailure, isEmailCollision, needsDocumentRestart } =
        useIdentityVerification()
    const { logoutUser, user } = useAuth()
    const t = useTranslations('kyc')
    const tIdentity = useTranslations('identity')
    const { setIsSupportModalOpen, openSupportWithMessage } = useModalsContext()

    // A block only support lifts gets a prefill naming it, so the agent looks
    // past this one account (TASK-24046).
    const supportCase = isEmailCollision ? 'duplicate-account' : supportCaseOf(identity.reason?.code)
    const supportCaseReasonKey = supportCase ? reasonCodeKey(identity.reason?.code) : undefined
    const contactSupport = () =>
        supportCase
            ? openSupportWithMessage(
                  buildSupportCaseMessage(supportCase, t(SUPPORT_CASE_MESSAGE_KEYS[supportCase]), identity.reason)
              )
            : setIsSupportModalOpen(true)

    // close drawer and release the keep-mounted hold
    const handleFlowDone = useCallback(() => {
        onClose()
        onKeepMounted?.(false)
    }, [onClose, onKeepMounted])

    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: handleFlowDone,
        onManualClose: handleFlowDone,
    })

    // An identity verified through a verification attempt shows its own status
    // instead: the verification timeline for Smart Paperwork Verification, the
    // setup status for the rest. This drawer opens only once that is ruled out,
    // so two drawers never follow each other.
    const router = useRouter()
    const handoffRef = useRef({ onClose, onKeepMounted, openSetupStatus: sumsubFlow.openSetupStatus, router })
    handoffRef.current = { onClose, onKeepMounted, openSetupStatus: sumsubFlow.openSetupStatus, router }
    const checksSetup = isOpen && !!user?.user?.userId && (status === 'processing' || status === 'verified')
    const [setupChecked, setSetupChecked] = useState(false)
    useEffect(() => {
        if (!checksSetup) {
            setSetupChecked(false)
            return
        }
        let cancelled = false
        void findKycSetup().then((setup) => {
            if (cancelled) return
            const handoff = handoffRef.current
            if (!setup) return setSetupChecked(true)
            handoff.onClose()
            if (setup.flow === PAPERWORK_VERIFICATION_FLOW) return handoff.router.push('/verify')
            handoff.onKeepMounted?.(true)
            handoff.openSetupStatus(setup.features, setup.refusals)
        })
        return () => {
            cancelled = true
        }
    }, [checksSetup])

    // close drawer but keep mounted so SumsubKycModals persists, then start kyc
    const resumeKyc = useCallback(async () => {
        onKeepMounted?.(true)
        onClose()
        try {
            // An approval with no identity document: the start route answers
            // "already approved" and opens nothing, so only the restart reaches
            // the document upload.
            await (needsDocumentRestart ? sumsubFlow.handleRestartIdentity() : sumsubFlow.handleInitiateKyc())
        } catch (e) {
            onKeepMounted?.(false)
            throw e
        }
    }, [onKeepMounted, onClose, sumsubFlow, needsDocumentRestart])

    const renderContent = () => {
        switch (status) {
            case 'processing':
                return <KycProcessing submittedAt={identity.submittedAt} />
            case 'verified':
                return <KycCompleted reviewedAt={identity.reviewedAt} />
            case 'action_required':
                // A FINAL rejection stored as action_required is a decision:
                // "Resubmit" cannot pass it, so it gets the failed view.
                if (isTerminalFailure) {
                    return (
                        <KycFailed
                            actionMessage={identity.actionMessage}
                            rejectLabels={identity.rejectLabels}
                            reviewedAt={identity.reviewedAt}
                            onRetry={resumeKyc}
                            isTerminal
                            onContactSupport={contactSupport}
                        />
                    )
                }
                return (
                    <KycActionRequired
                        onResume={resumeKyc}
                        isLoading={sumsubFlow.isLoading}
                        actionMessage={identity.actionMessage}
                        rejectLabels={identity.rejectLabels}
                        isEmailCollision={isEmailCollision}
                        onContactSupport={contactSupport}
                        onLogOut={() => {
                            onClose()
                            void logoutUser()
                        }}
                    />
                )
            case 'failed':
                // Region-restricted rejections are terminal in a way KycFailed's
                // "Retry verification" button contradicts — branch before it.
                if (isRegionRestricted) {
                    return <KycRegionRestricted reviewedAt={identity.reviewedAt} onNavigate={onClose} />
                }
                return (
                    <KycFailed
                        actionMessage={identity.actionMessage}
                        rejectLabels={identity.rejectLabels}
                        reviewedAt={identity.reviewedAt}
                        onRetry={resumeKyc}
                        isLoading={sumsubFlow.isLoading}
                        isTerminal={isTerminalFailure}
                        onContactSupport={contactSupport}
                        terminalMessage={supportCaseReasonKey && tIdentity(supportCaseReasonKey)}
                    />
                )
            default:
                return null
        }
    }

    // don't render the drawer if identity verification hasn't started.
    if (status === 'not_started') {
        return null
    }

    return (
        <>
            <Drawer open={isOpen && (!checksSetup || setupChecked)} onOpenChange={onClose}>
                <DrawerContent accessibleTitle={t('statusDrawerTitle')} className="pt-4" scrollAreaClassName="pb-12">
                    {renderContent()}
                    {sumsubFlow.error && (
                        <p className="mt-3 text-center text-body-s text-foreground-error">{sumsubFlow.error}</p>
                    )}
                </DrawerContent>
            </Drawer>
            <SumsubKycModals flow={sumsubFlow} />
        </>
    )
}
