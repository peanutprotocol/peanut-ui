import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useCapabilities } from '@/hooks/useCapabilities'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { deriveGate } from '@/utils/capability-gate'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { type KycModalPhase, type IUserProfile } from '@/interfaces/interfaces'
import { type UserCapabilities } from '@/types/capabilities'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const PREPARING_TIMEOUT_MS = 30000

const EMPTY_CAPABILITIES: UserCapabilities = { rails: [], nextActions: [], restrictions: [] }

/**
 * Phase-transition signals derived from the backend capability block — drives
 * the preparing → tos → complete orchestrator state machine.
 *
 *   - needsTos ← bank-channel rail in `requires-info` with a `bridge-tos`
 *     action (today, the ONLY ToS-acceptance flow on the platform — sources
 *     from the gate state's `accept-tos` kind, scoped to the bank channel).
 *   - anyPending ← any rail provisioning, no user action needed.
 *   - allSettled ← rails non-empty AND none pending.
 */
function deriveCapabilityPhaseSignals(capabilities: UserCapabilities | undefined) {
    const { rails, nextActions } = capabilities ?? EMPTY_CAPABILITIES
    const anyPending = rails.some((rail) => rail.status === 'pending')
    // The accept-tos branch sits above the identity check in deriveGate's
    // priority order; identityVerified doesn't affect it. Passing `false` here
    // is safe + avoids reading identityVerification.status to find a ToS state.
    const gate = deriveGate({ rails, nextActions, identityVerified: false, isLoading: false }, 'deposit', {
        channel: 'bank',
    })
    return {
        needsTos: gate.kind === 'accept-tos',
        anyPending,
        // mirrors old allSettled: empty rails are NOT settled (still provisioning)
        allSettled: rails.length > 0 && !anyPending,
        railCount: rails.length,
    }
}

/**
 * confirms bridge ToS acceptance (with one retry) then polls fetchUser
 * until bridge rails leave the TOS-required state. max 3 attempts × 2s.
 */
export async function confirmBridgeTosAndAwaitRails(fetchUser: () => Promise<IUserProfile | null>) {
    const result = await confirmBridgeTos()
    if (!result.data?.accepted) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await confirmBridgeTos()
    }

    // Arm the post-submission window only after the ToS POST has actually
    // completed (CodeRabbit feedback on #2131). Doing it before
    // `confirmBridgeTos()` would burn part of the 30s grace period waiting
    // for the BE write that hasn't happened yet. Now the full window covers
    // post-write Bridge-webhook propagation only, which is the latency we
    // actually want to cover.
    markSubmitted()

    for (let i = 0; i < 3; i++) {
        const updatedUser = await fetchUser()
        // MIGRATION-REVIEW: old check was `BRIDGE rail status === 'REQUIRES_INFORMATION'`
        // over raw `updatedUser.rails`. Now reads the fresh capability block from the
        // same fetch result via deriveBridgeGate (accept_tos == Bridge still needs ToS).
        const stillNeedsTos = deriveCapabilityPhaseSignals(updatedUser?.capabilities).needsTos
        if (!stillNeedsTos) break
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 2000))
    }
}

interface UseMultiPhaseKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

/**
 * reusable hook that wraps useSumsubKycFlow (WebSDK lifecycle) + useCapabilities
 * (backend rail/phase signals) to provide a complete multi-phase kyc flow:
 *   verifying → preparing → bridge_tos (if applicable) → complete
 *
 * use this hook anywhere kyc is initiated. pair with SumsubKycModals
 * for the modal rendering.
 */
export const useMultiPhaseKycFlow = ({ onKycSuccess, onManualClose, regionIntent }: UseMultiPhaseKycFlowOptions) => {
    const { fetchUser, user } = useAuth()
    const acquisitionSource = user?.invitedBy ? 'referred' : 'organic'

    // multi-phase modal state
    const [modalPhase, setModalPhase] = useState<KycModalPhase>('verifying')
    const [forceShowModal, setForceShowModal] = useState(false)
    const [preparingTimedOut, setPreparingTimedOut] = useState(false)
    const [preparingElapsed, setPreparingElapsed] = useState(0)
    const preparingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const preparingElapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isRealtimeFlowRef = useRef(false)

    // bridge ToS state
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [showTosIframe, setShowTosIframe] = useState(false)
    const [tosError, setTosError] = useState<string | null>(null)
    const [isLoadingTos, setIsLoadingTos] = useState(false)

    // ref for closeVerificationProgressModal (avoids circular dep with completeFlow)
    const closeVerificationModalRef = useRef<() => void>(() => {})

    // rail tracking — sourced from the backend capability model.
    // MIGRATION-REVIEW: replaces useRailStatusTracking. `allSettled` / `needsTos`
    // are now derived reactively from `useCapabilities()` (its rails update as the
    // user query is refetched). useCapabilities AUTO-POLLS the user query every ~4s
    // while any rail is `pending` (D4) and self-terminates when settled, so the old
    // explicit startTracking/stopTracking poll-lifecycle is no longer needed — they
    // are retained as no-ops to keep this hook's internal call sites untouched.
    // The old WebSocket-driven instant rail refresh is replaced by that 4s poll
    // (the old hook already had the same 4s poll as a fallback).
    const { capabilities } = useCapabilities()
    const { allSettled, needsTos } = useMemo(() => deriveCapabilityPhaseSignals(capabilities), [capabilities])
    const startTracking = useCallback(() => {}, [])
    const stopTracking = useCallback(() => {}, [])

    const clearPreparingTimer = useCallback(() => {
        if (preparingTimerRef.current) {
            clearTimeout(preparingTimerRef.current)
            preparingTimerRef.current = null
        }
        if (preparingElapsedIntervalRef.current) {
            clearInterval(preparingElapsedIntervalRef.current)
            preparingElapsedIntervalRef.current = null
        }
    }, [])

    // complete the flow — close everything, call original onKycSuccess
    const completeFlow = useCallback(() => {
        posthog.capture(
            regionIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_COMPLETED : ANALYTICS_EVENTS.KYC_APPROVED,
            { region_intent: regionIntent, acquisition_source: acquisitionSource }
        )
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        setModalPhase('verifying')
        setPreparingTimedOut(false)
        setTosLink(null)
        setShowTosIframe(false)
        setTosError(null)
        clearPreparingTimer()
        stopTracking()
        closeVerificationModalRef.current()
        onKycSuccess?.()
    }, [onKycSuccess, clearPreparingTimer, stopTracking, regionIntent, acquisitionSource])

    // called when sumsub status transitions to APPROVED
    const handleSumsubApproved = useCallback(async () => {
        // Open the post-submission window BEFORE the first fetchUser() so the
        // capability poller is already armed if the BE hasn't reflected the
        // Sumsub→Bridge transition yet. Without this, fetchUser() reads the
        // pre-submission snapshot once and `useCapabilities`'s `pending`-only
        // poll predicate keeps it dormant — and the user sees stale state until
        // the next route mount / window focus. See useSubmissionWindow.
        markSubmitted()

        // for real-time flow, optimistically show "Identity verified!" while we check rails
        if (isRealtimeFlowRef.current) {
            setModalPhase('preparing')
            setForceShowModal(true)
        }

        const updatedUser = await fetchUser()
        // post-approval branching reads the FRESH capability block from this
        // fetchUser() result (not the reactive useCapabilities() snapshot,
        // which would be stale within this synchronous call).
        const { needsTos, anyPending, railCount } = deriveCapabilityPhaseSignals(updatedUser?.capabilities)

        if (needsTos) {
            setModalPhase('bridge_tos')
            setForceShowModal(true)
            clearPreparingTimer()
            return
        }

        if (anyPending || (railCount === 0 && isRealtimeFlowRef.current)) {
            // rails still being set up — show preparing and start tracking
            setModalPhase('preparing')
            setForceShowModal(true)
            startTracking()
            return
        }

        // all settled — done
        completeFlow()
    }, [fetchUser, startTracking, clearPreparingTimer, completeFlow])

    const {
        isLoading,
        error,
        showWrapper,
        accessToken,
        liveKycStatus,
        handleInitiateKyc: originalHandleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        handleSdkComplete: originalHandleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        isActionFlow,
    } = useSumsubKycFlow({ onKycSuccess: handleSumsubApproved, onManualClose, regionIntent })

    // keep ref in sync
    useEffect(() => {
        closeVerificationModalRef.current = closeVerificationProgressModal
    }, [closeVerificationProgressModal])

    // refresh user store when kyc status transitions to a non-success state
    // so the drawer/status item reads the updated verification record
    useEffect(() => {
        if (liveKycStatus === 'ACTION_REQUIRED' || liveKycStatus === 'REJECTED') {
            posthog.capture(ANALYTICS_EVENTS.KYC_REJECTED, {
                region_intent: regionIntent,
                status: liveKycStatus,
            })
            fetchUser()
        }
    }, [liveKycStatus, fetchUser, regionIntent])

    // wrap handleSdkComplete to track real-time flow
    const handleSdkComplete = useCallback(() => {
        posthog.capture(ANALYTICS_EVENTS.KYC_SUBMITTED, { region_intent: regionIntent })
        isRealtimeFlowRef.current = true
        originalHandleSdkComplete()
        // for action flows (manteca, self-heal), the base status is already APPROVED
        // and won't transition — directly start the preparing/tracking phase
        if (isActionFlow) {
            handleSumsubApproved()
        }
    }, [originalHandleSdkComplete, handleSumsubApproved, isActionFlow, regionIntent])

    // wrap handleInitiateKyc to reset state for new attempts
    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent, levelName?: string, crossRegion?: boolean, targetCountry?: string) => {
            const intent = overrideIntent ?? regionIntent
            posthog.capture(
                intent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_INITIATED : ANALYTICS_EVENTS.KYC_INITIATED,
                { region_intent: intent, acquisition_source: acquisitionSource }
            )

            setModalPhase('verifying')
            setForceShowModal(false)
            setPreparingTimedOut(false)
            setTosLink(null)
            setShowTosIframe(false)
            setTosError(null)
            isRealtimeFlowRef.current = false
            clearPreparingTimer()

            await originalHandleInitiateKyc(overrideIntent, levelName, crossRegion, targetCountry)
        },
        [originalHandleInitiateKyc, clearPreparingTimer, regionIntent, acquisitionSource]
    )

    // 30s timeout for preparing phase + elapsed time counter for progressive copy
    useEffect(() => {
        if (modalPhase === 'preparing' && !preparingTimedOut) {
            clearPreparingTimer()
            preparingTimerRef.current = setTimeout(() => {
                setPreparingTimedOut(true)
            }, PREPARING_TIMEOUT_MS)
            // Start elapsed time counter for progressive copy stages
            preparingElapsedIntervalRef.current = setInterval(() => {
                setPreparingElapsed((prev) => prev + 1)
            }, 1000)
        } else {
            clearPreparingTimer()
            // Reset elapsed time when leaving preparing phase
            if (modalPhase !== 'preparing') {
                setPreparingElapsed(0)
            }
        }
    }, [modalPhase, preparingTimedOut, clearPreparingTimer])

    // phase transitions driven by rail tracking
    useEffect(() => {
        if (modalPhase === 'preparing') {
            if (needsTos) {
                setModalPhase('bridge_tos')
                clearPreparingTimer()
            } else if (allSettled) {
                setModalPhase('complete')
                clearPreparingTimer()
                stopTracking()
            }
        } else if (modalPhase === 'bridge_tos') {
            // after ToS accepted, rails transition to ENABLED
            if (allSettled && !needsTos) {
                setModalPhase('complete')
                stopTracking()
            }
        }
    }, [modalPhase, needsTos, allSettled, clearPreparingTimer, stopTracking])

    // handle "Accept Terms" click in bridge_tos phase
    const handleAcceptTerms = useCallback(async () => {
        setIsLoadingTos(true)
        setTosError(null)

        try {
            const response = await getBridgeTosLink()

            if (response.error || !response.data?.tosLink) {
                setTosError(
                    response.error || 'Could not load terms. You can accept them later from your activity feed.'
                )
                return
            }

            setTosLink(response.data.tosLink)
            setShowTosIframe(true)
        } catch {
            setTosError('Something went wrong. You can accept terms later from your activity feed.')
        } finally {
            setIsLoadingTos(false)
        }
    }, [])

    // handle ToS iframe close
    const handleTosIframeClose = useCallback(
        async (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setShowTosIframe(false)

            if (source === 'tos_accepted') {
                posthog.capture(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED)
                // show loading state while confirming + polling
                setModalPhase('preparing')
                try {
                    await confirmBridgeTosAndAwaitRails(fetchUser)
                    completeFlow()
                } catch {
                    // Don't leave the modal frozen on 'preparing' with no feedback
                    // if the confirm POST / rails poll throws — surface the
                    // timed-out recovery state immediately instead of a ~30s dead
                    // modal. (BridgeTosStep wraps the same call in try/catch.)
                    setPreparingTimedOut(true)
                }
            }
            // if manual close, stay on bridge_tos phase (user can try again)
        },
        [fetchUser, completeFlow]
    )

    // handle "Skip for now" in bridge_tos phase
    const handleSkipTerms = useCallback(() => {
        completeFlow()
    }, [completeFlow])

    // handle modal close (Go to Home, etc.)
    const handleModalClose = useCallback(() => {
        posthog.capture(
            regionIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_ABANDONED : ANALYTICS_EVENTS.KYC_ABANDONED,
            { region_intent: regionIntent, phase: modalPhase }
        )
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        clearPreparingTimer()
        stopTracking()
        closeVerificationProgressModal()
    }, [clearPreparingTimer, stopTracking, closeVerificationProgressModal, regionIntent, modalPhase])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            clearPreparingTimer()
            stopTracking()
        }
    }, [clearPreparingTimer, stopTracking])

    const isModalOpen = isVerificationProgressModalOpen || forceShowModal

    // multi-level only for first-time LATAM (workflow with conditional questionnaire).
    // cross-region LATAM uses an applicant action (single level, not multi-level).
    const isMultiLevel = regionIntent === 'LATAM' && !isActionFlow

    // Derive preparing stage from elapsed time for progressive copy
    const preparingStage = useMemo<'initial' | 'configuring' | 'slow'>(() => {
        if (preparingElapsed < 3) return 'initial'
        if (preparingElapsed < 8) return 'configuring'
        return 'slow'
    }, [preparingElapsed])

    return {
        // initiation
        handleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        isLoading,
        error,
        liveKycStatus,

        // SDK wrapper
        showWrapper,
        accessToken,
        handleSdkClose: handleClose,
        handleSdkComplete,
        refreshToken,
        isMultiLevel,

        // multi-phase modal
        isModalOpen,
        modalPhase,
        handleModalClose,
        handleAcceptTerms,
        handleSkipTerms,
        completeFlow,
        tosError,
        isLoadingTos,
        preparingTimedOut,
        preparingStage,

        // ToS iframe
        tosLink,
        showTosIframe,
        handleTosIframeClose,
    }
}
