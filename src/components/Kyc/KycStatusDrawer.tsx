import { KycActionRequired } from './states/KycActionRequired'
import { KycCompleted } from './states/KycCompleted'
import { KycFailed } from './states/KycFailed'
import { KycRegionRestricted } from './states/KycRegionRestricted'
import { KycProcessing } from './states/KycProcessing'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useCallback } from 'react'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'

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
    const { identity, status, isRegionRestricted, isTerminalFailure } = useIdentityVerification()
    const t = useTranslations('kyc')
    const { setIsSupportModalOpen } = useModalsContext()

    // close drawer and release the keep-mounted hold
    const handleFlowDone = useCallback(() => {
        onClose()
        onKeepMounted?.(false)
    }, [onClose, onKeepMounted])

    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: handleFlowDone,
        onManualClose: handleFlowDone,
    })

    // close drawer but keep mounted so SumsubKycModals persists, then start kyc
    const resumeKyc = useCallback(async () => {
        onKeepMounted?.(true)
        onClose()
        try {
            await sumsubFlow.handleInitiateKyc()
        } catch (e) {
            onKeepMounted?.(false)
            throw e
        }
    }, [onKeepMounted, onClose, sumsubFlow])

    const renderContent = () => {
        switch (status) {
            case 'processing':
                return <KycProcessing submittedAt={identity.submittedAt} />
            case 'verified':
                return <KycCompleted reviewedAt={identity.reviewedAt} />
            case 'action_required':
                return (
                    <KycActionRequired
                        onResume={resumeKyc}
                        isLoading={sumsubFlow.isLoading}
                        actionMessage={identity.actionMessage}
                        rejectLabels={identity.rejectLabels}
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
                        onContactSupport={() => setIsSupportModalOpen(true)}
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
            <Drawer open={isOpen} onOpenChange={onClose}>
                <DrawerContent accessibleTitle={t('statusDrawerTitle')} className="p-4 pb-12">
                    {renderContent()}
                    {sumsubFlow.error && <p className="mt-3 text-center text-body-s text-error">{sumsubFlow.error}</p>}
                </DrawerContent>
            </Drawer>
            <SumsubKycModals flow={sumsubFlow} />
        </>
    )
}
