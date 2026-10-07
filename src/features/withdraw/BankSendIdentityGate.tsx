'use client'

import { type ReactNode, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycActionRequired } from '@/components/Kyc/states/KycActionRequired'
import { KycFailed } from '@/components/Kyc/states/KycFailed'
import { KycProcessing } from '@/components/Kyc/states/KycProcessing'
import { KycRegionRestricted } from '@/components/Kyc/states/KycRegionRestricted'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'

/** All Send → Bank routes share this boundary, including native query routes. */
export function BankSendIdentityGate({ children }: { children: ReactNode }) {
    const { isBankFromSend } = useSendFlowOrigin()
    return isBankFromSend ? <IdentityGate>{children}</IdentityGate> : children
}

function IdentityGate({ children }: { children: ReactNode }) {
    const tNav = useTranslations('navigation')
    const onBack = useSafeBack('/send', { replace: true })
    const { user, logoutUser, fetchUser } = useAuth()
    const { setIsSupportModalOpen } = useModalsContext()
    const {
        identity,
        status,
        isVerified,
        isRegionRestricted,
        isTerminalFailure,
        isEmailCollision,
        needsDocumentRestart,
    } = useIdentityVerification()
    // No destination has been chosen yet: start the same identity check as
    // Home. Country/provider enrollment remains with the destination's gate.
    const flow = useMultiPhaseKycFlow({})
    // A returning user may be waiting on a check started elsewhere. That
    // approval does not complete this hook's own SDK attempt, so refresh the
    // profile when its websocket reports approval as well.
    useEffect(() => {
        if (!isVerified && flow.liveKycStatus === 'APPROVED') void fetchUser()
    }, [isVerified, flow.liveKycStatus, fetchUser])

    const onVerify = async () => {
        if (needsDocumentRestart) await flow.handleRestartIdentity()
        else await flow.handleInitiateKyc()
    }
    const onContactSupport = () => setIsSupportModalOpen(true)

    const content = () => {
        if (!user) return <Loading variant="mascot" />
        if (isVerified) return children

        if (status === 'not_started') {
            return (
                <InitiateKycModal
                    visible
                    presentation="page"
                    navTitle={tNav('send')}
                    onBack={onBack}
                    onClose={onBack}
                    onVerify={onVerify}
                    onContactSupport={onContactSupport}
                    cooldownActive={!!flow.errorCooldown}
                    isLoading={flow.isLoading}
                    error={flow.error}
                />
            )
        }

        return (
            <PageStack>
                <NavHeader title={tNav('send')} onPrev={onBack} />
                {status === 'processing' ? (
                    <KycProcessing submittedAt={identity.submittedAt} />
                ) : isRegionRestricted ? (
                    <KycRegionRestricted reviewedAt={identity.reviewedAt} />
                ) : status === 'failed' || isTerminalFailure ? (
                    <KycFailed
                        actionMessage={identity.actionMessage}
                        rejectLabels={identity.rejectLabels}
                        reviewedAt={identity.reviewedAt}
                        onRetry={onVerify}
                        isLoading={flow.isLoading}
                        isTerminal={isTerminalFailure}
                        onContactSupport={onContactSupport}
                    />
                ) : (
                    <KycActionRequired
                        onResume={onVerify}
                        isLoading={flow.isLoading}
                        actionMessage={identity.actionMessage}
                        rejectLabels={identity.rejectLabels}
                        isEmailCollision={isEmailCollision}
                        onContactSupport={onContactSupport}
                        onLogOut={() => void logoutUser()}
                    />
                )}
                {flow.error && <p className="text-body-s text-foreground-error">{flow.error}</p>}
            </PageStack>
        )
    }

    return (
        <>
            {content()}
            {/* Keep the active SDK/progress host mounted when approval reveals the flow. */}
            <SumsubKycModals flow={flow} onCooldownClose={onBack} />
        </>
    )
}
