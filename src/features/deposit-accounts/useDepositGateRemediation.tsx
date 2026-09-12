'use client'

import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useModalsContext } from '@/context/ModalsContext'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useTosGuard } from '@/hooks/useTosGuard'
import { getGateReasonCode, getGateUserMessage, resolveKycModalVariant, type GateState } from '@/utils/capability-gate'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * What the gate banner's button actually does, and the UI it needs mounted.
 *
 * Every kind used to end in `handleInitiateKyc()`. That is wrong four ways:
 * a terms block wants the terms sheet, a missing email wants the email sheet,
 * a fixable rejection wants a resubmit rather than a fresh run, and none of
 * them render at all unless the Sumsub hosts are on the page. So the dispatch
 * and the hosts live together here, mirroring what /add-money mounts, and the
 * page renders `modals` once.
 */
export function useDepositGateRemediation(): { resolveGate: (gate: GateState) => void; modals: ReactNode } {
    const sumsubFlow = useMultiPhaseKycFlow({})
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const { setIsSupportModalOpen } = useModalsContext()
    const [showProvideEmail, setShowProvideEmail] = useState(false)
    const [kycModalGate, setKycModalGate] = useState<GateState | undefined>()
    const [tosReasonCode, setTosReasonCode] = useState<string | undefined>()

    // the SDK takes over the screen; the modal that offered to open it should not
    // still be sitting behind it
    useEffect(() => {
        if (sumsubFlow.showWrapper) setKycModalGate(undefined)
    }, [sumsubFlow.showWrapper])

    const resolveGate = (gate: GateState) => {
        switch (gate.kind) {
            case 'loading':
            case 'ready':
            case 'pending':
            case 'waiting-on-provider':
                // nothing for the user to do; the banner offers no button either
                return
            case 'accept-tos':
                setTosReasonCode(gate.reason?.code)
                guardWithTos()
                return
            case 'provide-email':
                setShowProvideEmail(true)
                return
            case 'blocked-rejection':
                setIsSupportModalOpen(true)
                return
            default:
                // needs-identity, needs-enrollment, fixable-rejection,
                // restart-identity: all start in the same modal, which reads the
                // gate to pick its words and which run to start
                setKycModalGate(gate)
        }
    }

    const modals = (
        <>
            <InitiateKycModal
                cooldownActive={!!sumsubFlow.errorCooldown}
                visible={kycModalGate !== undefined}
                onClose={() => setKycModalGate(undefined)}
                onVerify={async () => {
                    if (kycModalGate?.kind === 'fixable-rejection') {
                        // a document the provider rejected is resubmitted, not
                        // re-collected from scratch
                        await sumsubFlow.handleSelfHealResubmit('BRIDGE')
                        return
                    }
                    await sumsubFlow.handleInitiateKyc(
                        undefined,
                        undefined,
                        kycModalGate?.kind === 'needs-enrollment' || undefined
                    )
                }}
                onContactSupport={() => {
                    setKycModalGate(undefined)
                    setIsSupportModalOpen(true)
                }}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={kycModalGate ? resolveKycModalVariant(kycModalGate) : undefined}
                providerMessage={(kycModalGate && getGateUserMessage(kycModalGate)) || undefined}
                reasonCode={(kycModalGate && getGateReasonCode(kycModalGate)) || undefined}
            />
            <BridgeTosStep visible={showBridgeTos} onComplete={hideTos} onSkip={hideTos} reasonCode={tosReasonCode} />
            <ProvideEmailStep
                visible={showProvideEmail}
                onComplete={() => setShowProvideEmail(false)}
                onSkip={() => setShowProvideEmail(false)}
            />
            <SumsubKycModals flow={sumsubFlow} onCooldownClose={() => setKycModalGate(undefined)} />
        </>
    )

    return { resolveGate, modals }
}
