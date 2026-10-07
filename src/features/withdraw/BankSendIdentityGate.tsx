'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
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

// Six sequential reads with a capped backoff. A websocket approval can arrive
// ahead of the profile read model; a failed read must not strand this gate.
const APPROVAL_REFRESH_DELAYS_MS = [1000, 2000, 4000, 8000, 8000]

/** All Send → Bank routes share this boundary, including native query routes. */
export function BankSendIdentityGate({ children }: { children: ReactNode }) {
    const { isBankFromSend } = useSendFlowOrigin()
    return isBankFromSend ? <IdentityGate>{children}</IdentityGate> : children
}

function IdentityGate({ children }: { children: ReactNode }) {
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
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
    const userId = user?.user.userId
    const [approvalRefreshCycle, setApprovalRefreshCycle] = useState(0)
    const [approvalRefreshExhausted, setApprovalRefreshExhausted] = useState(false)
    // A returning user may be waiting on a check started elsewhere, outside
    // the local submission window. Retry stale/failed reads independently of
    // the generic rail poller; never overlap reads or carry them across accounts.
    useEffect(() => {
        setApprovalRefreshExhausted(false)
        if (!userId || isVerified || flow.liveKycStatus !== 'APPROVED') return
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        let attempt = 0
        const refresh = async () => {
            try {
                const profile = await fetchUser({ throwOnError: true })
                if (cancelled) return
                if (profile?.user.userId === userId && profile.identityVerification?.status === 'verified') return
            } catch {
                // The user query reports the read error. Keep the processing
                // state and retry rather than treating a failed read as a verdict.
            }
            if (cancelled) return
            const delay = APPROVAL_REFRESH_DELAYS_MS[attempt++]
            if (delay === undefined) setApprovalRefreshExhausted(true)
            else timer = setTimeout(() => void refresh(), delay)
        }
        void refresh()
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [userId, isVerified, flow.liveKycStatus, fetchUser, approvalRefreshCycle])

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
                {approvalRefreshExhausted && flow.liveKycStatus === 'APPROVED' && (
                    <Button variant="secondary" onClick={() => setApprovalRefreshCycle((cycle) => cycle + 1)}>
                        {tCommon('retry')}
                    </Button>
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
