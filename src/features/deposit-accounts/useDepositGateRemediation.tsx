'use client'

import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useTosGuard } from '@/hooks/useTosGuard'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { useGateActions } from '@/hooks/useGateActions'
import { getGateReasonCode, getGateUserMessage, resolveKycModalVariant, type GateState } from '@/utils/capability-gate'
import { useToast } from '@/components/0_Bruddle/Toast'
import { RESIDENCE_ADDRESS_ACTION_KEY } from '@/constants/kyc.consts'
import { useOptionalAuth } from '@/context/authContext'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isAddressStepGate } from './addressStep'
import { trackAddressStepSubmitted } from './analytics'
import { DEPOSIT_RAILS, railIdFor } from './rails'
import type { DepositCorridor } from './types'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from './useDepositAccounts'
import { BridgePostalCorrectionModal } from './components/BridgePostalCorrectionModal'
import { AddressLaunchModal } from './components/AddressLaunchModal'

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
export function useDepositGateRemediation(): {
    resolveGate: (gate: GateState, corridor?: DepositCorridor) => void
    /** the claim answered `verification_required`: start the level this corridor needs */
    verifyCorridor: (corridor: DepositCorridor) => void
    modals: ReactNode
} {
    const t = useTranslations('depositAccounts')
    const owner = useOptionalAuth()?.user?.user?.userId
    const ownerRef = useRef(owner)
    ownerRef.current = owner
    const toast = useToast()
    const queryClient = useQueryClient()
    // The corridor the address step was opened for, read when the SDK reports the submission.
    const addressCorridor = useRef<DepositCorridor | undefined>(undefined)
    const sumsubFlow = useMultiPhaseKycFlow({
        onActionSubmitted: (key) => {
            if (key !== RESIDENCE_ADDRESS_ACTION_KEY) return
            if (addressCorridor.current) trackAddressStepSubmitted(addressCorridor.current)
            toast.info(t('gate.addressSent'))
            // The corridors say "under review" once Sumsub has the answer; read them again now.
            void queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY })
        },
    })
    const { gateFor } = useCapabilities()
    const { openTos, showBridgeTos, hideTos } = useTosGuard()
    const gateActions = useGateActions(sumsubFlow)
    const bridgeProviderId = useBridgeProviderId()
    const [postalGate, setPostalGate] = useState<GateState>()
    const [showProvideEmail, setShowProvideEmail] = useState(false)
    const [kycModalGate, setKycModalGate] = useState<GateState | undefined>()
    // The corridor the verification is for. It is what the backend opens the
    // level from — the same request for every corridor, from every entry point
    // (the list, the country pick, the claim) — so the user lands back on the
    // corridor they tapped, one verification later.
    const [kycCorridor, setKycCorridor] = useState<DepositCorridor | undefined>()
    const [addressLaunch, setAddressLaunch] = useState<{
        gate: GateState
        corridor?: DepositCorridor
        owner: typeof owner
    }>()
    const [addressStarting, setAddressStarting] = useState(false)
    const [addressLaunchError, setAddressLaunchError] = useState<string | null>(null)
    const addressPending = useRef(false)
    const addressGeneration = useRef(0)

    useEffect(() => {
        addressPending.current = false
        setAddressLaunch(undefined)
        setPostalGate(undefined)
        setAddressStarting(false)
        setAddressLaunchError(null)
        return () => {
            addressGeneration.current += 1
        }
    }, [owner])

    const closeAddressLaunch = () => {
        if (ownerRef.current !== owner) return
        addressGeneration.current += 1
        addressPending.current = false
        setAddressLaunch(undefined)
        setAddressStarting(false)
        setAddressLaunchError(null)
        sumsubFlow.handleSdkClose()
    }

    const startAddress = async (gate: GateState, corridor?: DepositCorridor) => {
        if (addressPending.current || ownerRef.current !== owner) return
        const generation = ++addressGeneration.current
        addressPending.current = true
        addressCorridor.current = corridor
        setAddressLaunch({ gate, corridor, owner })
        setAddressStarting(true)
        setAddressLaunchError(null)
        const current = () => ownerRef.current === owner && addressGeneration.current === generation
        try {
            await gateActions.verify(gate, {
                provider: corridor && DEPOSIT_RAILS[corridor].provider === 'manteca' ? 'MANTECA' : 'BRIDGE',
                corridor,
            })
        } catch {
            if (current()) setAddressLaunchError(t('gate.actFailed'))
        } finally {
            if (current()) {
                addressPending.current = false
                setAddressStarting(false)
            }
        }
    }

    // the SDK takes over the screen; the modal that offered to open it should not
    // still be sitting behind it
    useEffect(() => {
        if (sumsubFlow.showWrapper) {
            setKycModalGate(undefined)
            setAddressLaunch(undefined)
        }
    }, [sumsubFlow.showWrapper])

    const resolveGate = (gate: GateState, corridor?: DepositCorridor) => {
        setKycCorridor(corridor)
        if (
            corridor &&
            DEPOSIT_RAILS[corridor].provider === 'bridge' &&
            getGateReasonCode(gate) === 'invalid_bank_postal_code'
        ) {
            setPostalGate(gate)
            return
        }
        // The drawer already explained the address step: open it, with no second screen in front.
        if (isAddressStepGate(gate)) {
            void startAddress(gate, corridor)
            return
        }
        if (addressLaunch) closeAddressLaunch()
        switch (gate.kind) {
            case 'loading':
            case 'ready':
            case 'pending':
            case 'waiting-on-provider':
                // nothing for the user to do; the banner offers no button either
                return
            case 'accept-tos':
                openTos()
                return
            case 'provide-email':
                setShowProvideEmail(true)
                return
            case 'blocked-rejection':
                gateActions.contactSupport(gate)
                return
            default:
                // needs-identity, needs-enrollment, fixable-rejection,
                // restart-identity: all start in the same modal, which reads the
                // gate to pick its words and which run to start (gateRemedy)
                setKycModalGate(gate)
        }
    }

    const addressError = addressStarting ? null : (addressLaunchError ?? sumsubFlow.error)
    const addressVisible =
        addressLaunch?.owner === owner &&
        !!addressLaunch &&
        !sumsubFlow.showWrapper &&
        !sumsubFlow.errorCooldown &&
        (addressStarting || !!addressError)
    const modals = (
        <>
            <BridgePostalCorrectionModal
                visible={!!postalGate}
                onClose={() => setPostalGate(undefined)}
                onSupport={() => {
                    if (postalGate) gateActions.contactSupport(postalGate)
                    setPostalGate(undefined)
                }}
                onQueued={() => {
                    void queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY })
                }}
            />
            <AddressLaunchModal
                visible={addressVisible}
                onClose={closeAddressLaunch}
                loading={addressStarting}
                error={addressError}
                terminal={sumsubFlow.isTerminalError}
                onRetry={() => {
                    if (addressLaunch) void startAddress(addressLaunch.gate, addressLaunch.corridor)
                }}
                onContactSupport={() => {
                    if (!addressLaunch) return
                    closeAddressLaunch()
                    gateActions.contactSupport(addressLaunch.gate)
                }}
            />
            <InitiateKycModal
                cooldownActive={!!sumsubFlow.errorCooldown}
                visible={kycModalGate !== undefined}
                onClose={() => setKycModalGate(undefined)}
                onVerify={async () => {
                    if (!kycModalGate) return
                    // The corridor, where there is one, names the level: a
                    // verified user moves on to it, a new one starts there.
                    await gateActions.verify(kycModalGate, {
                        provider:
                            kycCorridor && DEPOSIT_RAILS[kycCorridor].provider === 'manteca' ? 'MANTECA' : 'BRIDGE',
                        corridor: kycCorridor,
                    })
                }}
                onContactSupport={() => {
                    const gate = kycModalGate
                    setKycModalGate(undefined)
                    if (gate) gateActions.contactSupport(gate)
                }}
                isLoading={sumsubFlow.isLoading}
                error={sumsubFlow.error}
                variant={kycModalGate ? resolveKycModalVariant(kycModalGate) : undefined}
                providerMessage={(kycModalGate && getGateUserMessage(kycModalGate)) || undefined}
                reasonCode={(kycModalGate && getGateReasonCode(kycModalGate)) || undefined}
                nextAction={kycModalGate?.kind === 'fixable-rejection' ? kycModalGate.nextAction : undefined}
                providerId={
                    kycCorridor && DEPOSIT_RAILS[kycCorridor].provider === 'bridge' ? bridgeProviderId : undefined
                }
                verifyEntry={{ corridor: kycCorridor }}
            />
            <BridgeTosStep
                visible={showBridgeTos}
                country={kycCorridor ? DEPOSIT_RAILS[kycCorridor].flagIso2.toUpperCase() : undefined}
                onComplete={hideTos}
                onSkip={hideTos}
            />
            <ProvideEmailStep
                visible={showProvideEmail}
                onComplete={() => setShowProvideEmail(false)}
                onSkip={() => setShowProvideEmail(false)}
            />
            <SumsubKycModals
                flow={sumsubFlow}
                onCooldownClose={() => {
                    setKycModalGate(undefined)
                    if (addressLaunch) closeAddressLaunch()
                }}
            />
        </>
    )

    const verifyCorridor = (corridor: DepositCorridor) =>
        resolveGate(gateFor('deposit', { railId: railIdFor(corridor) }), corridor)

    return { resolveGate, verifyCorridor, modals }
}
