import { railJurisdictionForBank } from '@/utils/bridge.utils'
import { useTranslations } from 'next-intl'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useSumsubReloadResume, type KycResumeState } from '@/hooks/useSumsubReloadResume'
import { useCapabilities } from '@/hooks/useCapabilities'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { deriveGate } from '@/utils/capability-gate'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import { type KycModalPhase, type IUserProfile } from '@/interfaces/interfaces'
import { type UserCapabilities } from '@/types/capabilities'
import { type KYCRegionIntent, type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
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
 *   - allSettled ← at least one usable deposit rail for the requested destination.
 */
export function deriveCapabilityPhaseSignals(
    capabilities: UserCapabilities | undefined,
    intent?: KYCRegionIntent,
    targetCountry?: string
) {
    const { rails: allRails, nextActions } = capabilities ?? EMPTY_CAPABILITIES
    const jurisdiction = railJurisdictionForBank(targetCountry)
    const rails = allRails.filter(
        (rail) =>
            rail.channel === 'bank' &&
            (intent === 'LATAM'
                ? rail.provider === 'manteca'
                : intent === 'EU' || intent === 'NA'
                  ? rail.provider === 'bridge'
                  : true) &&
            (jurisdiction
                ? rail.country === jurisdiction
                : intent === 'EU'
                  ? rail.currency === 'EUR'
                  : intent === 'NA'
                    ? rail.currency === 'USD'
                    : true)
    )
    const anyPending = rails.some((rail) => (rail.operations?.deposit ?? rail.status) === 'pending')
    // The accept-tos branch sits above the identity check in deriveGate's
    // priority order; identityVerified doesn't affect it. Passing `false` here
    // is safe + avoids reading identityVerification.status to find a ToS state.
    const gate = deriveGate({ rails, nextActions, identityVerified: false, isLoading: false }, 'deposit', {
        channel: 'bank',
    })
    return {
        needsTos: gate.kind === 'accept-tos',
        anyPending,
        allBlocked: rails.length > 0 && rails.every((rail) => (rail.operations?.deposit ?? rail.status) === 'blocked'),
        // mirrors old allSettled: empty rails are NOT settled (still provisioning)
        allSettled: rails.some((rail) => (rail.operations?.deposit ?? rail.status) === 'enabled'),
        railCount: rails.length,
    }
}

/**
 * confirms bridge ToS acceptance (with one retry) then polls fetchUser
 * until bridge rails leave the TOS-required state. max 3 attempts × 2s.
 *
 * Returns Bridge's own verdict on whether the terms are signed. Callers that
 * never saw an acceptance signal (the android system-browser detour, where
 * the only event is "the user came back") need it to tell a real acceptance
 * from an abandoned one.
 *
 * `observedAcceptance` says whether the caller SAW Bridge report a signature
 * (the iframe's `tos_accepted` postMessage). When it did, a "no" from the
 * confirm endpoint is treated as webhook lag: we still arm the submission
 * window and poll the rails, exactly as the web flow always has. Without it
 * (android's `returned`), a "no" after the retry means the user backed out —
 * marking a submission or polling for rails that will never change would arm
 * the 30s grace window for nothing and stall the error by ~6s, so we stop.
 */
export async function confirmBridgeTosAndAwaitRails(
    fetchUser: () => Promise<IUserProfile | null>,
    { observedAcceptance = true }: { observedAcceptance?: boolean } = {}
): Promise<boolean> {
    let accepted = !!(await confirmBridgeTos()).data?.accepted
    if (!accepted) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        accepted = !!(await confirmBridgeTos()).data?.accepted
    }

    if (!accepted && !observedAcceptance) return false

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

    return accepted
}

interface UseMultiPhaseKycFlowOptions {
    onKycSuccess?: () => void
    /**
     * Fired the moment Sumsub reports approval (the verification was submitted),
     * BEFORE the post-approval ToS / rail-preparing steps. Use this for
     * "completed the verification" signals so they aren't lost when the user
     * drops during those follow-up steps. `onKycSuccess` still fires later, once
     * the whole flow settles.
     */
    onKycApproved?: () => void
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
export const useMultiPhaseKycFlow = ({
    onKycSuccess,
    onKycApproved,
    onManualClose,
    regionIntent,
}: UseMultiPhaseKycFlowOptions) => {
    const { fetchUser, user } = useAuth()
    const t = useTranslations('kyc')
    const acquisitionSource = user?.invitedBy ? 'referred' : 'organic'

    // multi-phase modal state
    const [modalPhase, setModalPhase] = useState<KycModalPhase>('verifying')
    const [forceShowModal, setForceShowModal] = useState(false)
    const [preparingTimedOut, setPreparingTimedOut] = useState(false)
    const [preparingElapsed, setPreparingElapsed] = useState(0)
    const preparingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const preparingElapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isRealtimeFlowRef = useRef(false)

    // effective region intent for analytics — Manteca entry points instantiate this
    // hook with no `regionIntent` and pass 'LATAM' only as an override to
    // handleInitiateKyc, so the hook-level prop alone misattributes the
    // completed/abandoned events (LATAM successes fired as kyc_approved with
    // region_intent: None). The last initiated intent wins over the prop.
    const lastIntentRef = useRef<KYCRegionIntent | undefined>(undefined)
    const [requestedIntent, setRequestedIntent] = useState<KYCRegionIntent | undefined>(regionIntent)
    const [requestedCountry, setRequestedCountry] = useState<string | undefined>()

    // Terminal status already reported for the CURRENT attempt. Cleared on each
    // submission, so a re-opened SDK cannot re-report the same rejection while a
    // genuinely new rejection after a retry still reports (status alone cannot
    // tell those apart — liveKycStatus stays REJECTED across both).
    const reportedRejectionRef = useRef<string | null>(null)

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
    const { allSettled, needsTos, allBlocked } = useMemo(
        () => deriveCapabilityPhaseSignals(capabilities, requestedIntent, requestedCountry),
        [capabilities, requestedIntent, requestedCountry]
    )
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
        const effectiveIntent = lastIntentRef.current ?? regionIntent
        posthog.capture(
            effectiveIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_COMPLETED : ANALYTICS_EVENTS.KYC_APPROVED,
            { region_intent: effectiveIntent, acquisition_source: acquisitionSource }
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

        // Sumsub approved the submission — the verification flow is done from the
        // user's side. Fire here (not in completeFlow) so a "completed" signal
        // survives a drop during the post-approval ToS / preparing steps.
        onKycApproved?.()

        // for real-time flow, optimistically show "Identity verified!" while we check rails
        if (isRealtimeFlowRef.current) {
            setModalPhase('preparing')
            setForceShowModal(true)
        }

        const updatedUser = await fetchUser()
        // post-approval branching reads the FRESH capability block from this
        // fetchUser() result (not the reactive useCapabilities() snapshot,
        // which would be stale within this synchronous call).
        const { needsTos, anyPending, railCount, allSettled } = deriveCapabilityPhaseSignals(
            updatedUser?.capabilities,
            lastIntentRef.current ?? regionIntent,
            requestedCountry
        )

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

        if (allSettled) completeFlow()
        else {
            setModalPhase('preparing')
            setForceShowModal(true)
            startTracking()
        }
    }, [fetchUser, startTracking, clearPreparingTimer, completeFlow, onKycApproved, regionIntent, requestedCountry])

    const {
        isLoading,
        error,
        errorCooldown,
        dismissErrorCooldown,
        isTerminalError,
        showWrapper,
        accessToken,
        liveKycStatus,
        handleInitiateKyc: originalHandleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        handleFixableRejection,
        handleSdkComplete: originalHandleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        isActionFlow,
        isMultiLevel,
        verificationSession,
        showCorrection,
        correctVerificationData,
        dismissCorrection,
    } = useSumsubKycFlow({ onKycSuccess: handleSumsubApproved, onManualClose, regionIntent })

    // keep ref in sync
    useEffect(() => {
        closeVerificationModalRef.current = closeVerificationProgressModal
    }, [closeVerificationProgressModal])

    // refresh user store when kyc status transitions to a non-success state
    // so the drawer/status item reads the updated verification record
    const prevCapturedStatusRef = useRef<SumsubKycStatus | undefined>(undefined)
    useEffect(() => {
        // Same defer guard as the transition effect in useSumsubKycFlow: while a
        // multi-level SDK session is open, ACTION_REQUIRED is the routine "the
        // follow-up questionnaire is showing" status (the backend maps the
        // follow-up level's `init` state to it ~3 min after the documents are
        // submitted). Acting on it here would log a bogus KYC_REJECTED for every
        // succeeding EEA applicant and flip the user store to action_required
        // under the open SDK. The effect re-runs when the SDK closes, so an
        // abandoned session still gets the capture and the store refresh —
        // unless the close was a submission, which consumes the deferral
        // (handleSdkComplete / handleSdkClose advance the ref below).
        if (liveKycStatus === 'ACTION_REQUIRED' && showWrapper && isMultiLevel) return
        // Edge-triggered like that sibling effect: the other deps also change
        // during a resubmit round (setShowWrapper toggles while the status is a
        // stale REJECTED/ACTION_REQUIRED), which used to fire duplicate
        // KYC_REJECTED captures and redundant fetchUser calls.
        const prevStatus = prevCapturedStatusRef.current
        prevCapturedStatusRef.current = liveKycStatus
        if (liveKycStatus === prevStatus) return
        if (liveKycStatus === 'ACTION_REQUIRED' || liveKycStatus === 'REJECTED') {
            if (reportedRejectionRef.current === liveKycStatus) return
            reportedRejectionRef.current = liveKycStatus
            posthog.capture(ANALYTICS_EVENTS.KYC_REJECTED, {
                region_intent: lastIntentRef.current ?? regionIntent,
                status: liveKycStatus,
            })
            fetchUser()
        }
    }, [liveKycStatus, fetchUser, regionIntent, showWrapper, isMultiLevel])

    // A multi-level session never reaches handleSdkComplete on the happy path:
    // the SDK stays open through the follow-up level and the APPROVED transition
    // closes it without onComplete. The wrapper reports the Level-1 submit
    // through onSubmitted instead, so the funnel still gets its KYC_SUBMITTED.
    const handleSdkSubmitted = useCallback(() => {
        reportedRejectionRef.current = null
        posthog.capture(ANALYTICS_EVENTS.KYC_SUBMITTED, { region_intent: lastIntentRef.current ?? regionIntent })
    }, [regionIntent])

    // wrap handleSdkComplete to track real-time flow
    const handleSdkComplete = useCallback(() => {
        reportedRejectionRef.current = null
        posthog.capture(ANALYTICS_EVENTS.KYC_SUBMITTED, { region_intent: lastIntentRef.current ?? regionIntent })
        isRealtimeFlowRef.current = true
        // Deliberately does NOT consume a deferred ACTION_REQUIRED for the capture
        // effect. On native this callback is ambiguous in a multi-level session:
        // SumsubNativeSdk marks Pending as submitted, so a Level-1 submit followed
        // by backing out of Level 2 arrives here exactly like a real completion.
        // Suppressing the capture and the user-store refresh on that path would
        // strand the applicant on a stale progress modal. (originalHandleSdkComplete
        // still consumes for the sibling transition effect — pre-existing, and the
        // same ambiguity applies to it.)
        originalHandleSdkComplete()
        // for action flows (manteca, self-heal), the base status is already APPROVED
        // and won't transition — directly start the preparing/tracking phase
        if (isActionFlow && !verificationSession) {
            handleSumsubApproved()
        }
    }, [originalHandleSdkComplete, handleSumsubApproved, isActionFlow, regionIntent, verificationSession])

    // true only while a PWA-reload resume drives handleInitiateKyc, so the
    // analytics event can distinguish a resume from a genuine new initiation
    // (a resume otherwise looks identical and inflates "initiated" counts).
    const resumingRef = useRef(false)

    // Arguments of the initiate that opened the SDK, replayed on resume. The
    // LATAM surfaces build the flow as `useMultiPhaseKycFlow({})` and pass the
    // intent at call time, so a resume that re-initiates with hook defaults
    // there mints a token for the wrong verification level — and still opens the
    // SDK, so the flag is not cleared and the user never sees what went wrong.
    // The resolved intent is stored rather than the raw override so the replay
    // pins the exact intent used.
    const lastInitiateArgsRef = useRef<KycResumeState>({})

    // wrap handleInitiateKyc to reset state for new attempts
    const handleInitiateKyc = useCallback(
        async (overrideIntent?: KYCRegionIntent, levelName?: string, crossRegion?: boolean, targetCountry?: string) => {
            const intent = overrideIntent ?? regionIntent
            lastIntentRef.current = intent
            setRequestedIntent(intent)
            lastInitiateArgsRef.current = { intent, levelName, crossRegion, targetCountry }
            posthog.capture(
                intent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_INITIATED : ANALYTICS_EVENTS.KYC_INITIATED,
                { region_intent: intent, acquisition_source: acquisitionSource, resumed: resumingRef.current }
            )

            setRequestedCountry(targetCountry?.toUpperCase())
            setModalPhase('verifying')
            setForceShowModal(false)
            setPreparingTimedOut(false)
            setTosLink(null)
            setShowTosIframe(false)
            setTosError(null)
            isRealtimeFlowRef.current = false
            clearPreparingTimer()

            return originalHandleInitiateKyc(overrideIntent, levelName, crossRegion, targetCountry)
        },
        [originalHandleInitiateKyc, clearPreparingTimer, regionIntent, acquisitionSource]
    )

    // PWA-reload resume (see useSumsubReloadResume). On mount, if the state is
    // in the URL but the SDK is closed, re-initiate with the same arguments:
    // mint a fresh token for the existing applicant and reopen the SDK. The SDK
    // now launches straight into Sumsub on open (the StartVerificationView intro
    // was removed with the native-SDK refactor), so no extra auto-start step is
    // needed.
    useSumsubReloadResume(showWrapper ? lastInitiateArgsRef.current : null, async (state) => {
        // Returns whether the SDK actually opened — a resume that resolves
        // without opening (already-approved user, or a remediation flow the
        // replay can't reconstruct) clears the state instead of retrying on
        // every future reload.
        resumingRef.current = true
        const opened = await handleInitiateKyc(state.intent, state.levelName, state.crossRegion, state.targetCountry)
        resumingRef.current = false
        return !!opened
    })

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

    const completedSessionRef = useRef<string | null>(null)
    const sessionId = verificationSession?.id
    const sessionGeneration = verificationSession?.generation
    const sessionState = verificationSession?.state
    const sessionCountry = verificationSession?.targetCountry
    useEffect(() => {
        if (!sessionId) return
        if (sessionState === 'CORRECTION_REQUIRED' || sessionState === 'BLOCKED') {
            setForceShowModal(false)
            clearPreparingTimer()
            return
        }
        if (!isVerificationProgressModalOpen) return
        setModalPhase('preparing')
        if (sessionState !== 'READY') return
        const key = `${sessionId}:${sessionGeneration}`
        if (completedSessionRef.current === key) return
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const refreshBeforeCompletion = async () => {
            markSubmitted()
            try {
                const refreshed = await fetchUser()
                if (cancelled) return
                if (deriveCapabilityPhaseSignals(refreshed?.capabilities, 'LATAM', sessionCountry).allSettled) {
                    completedSessionRef.current = key
                    completeFlow()
                    return
                }
            } catch {
                // Keep the flow pending until the refreshed downstream gate is usable.
            }
            if (!cancelled) timer = setTimeout(refreshBeforeCompletion, 4000)
        }
        void refreshBeforeCompletion()
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [
        sessionId,
        sessionGeneration,
        sessionState,
        sessionCountry,
        isVerificationProgressModalOpen,
        fetchUser,
        completeFlow,
        clearPreparingTimer,
    ])

    // phase transitions driven by rail tracking
    useEffect(() => {
        if (verificationSession) return
        if (modalPhase === 'preparing') {
            if (allBlocked) {
                clearPreparingTimer()
                stopTracking()
                setForceShowModal(false)
                closeVerificationProgressModal()
                return
            }
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
    }, [
        modalPhase,
        needsTos,
        allSettled,
        allBlocked,
        clearPreparingTimer,
        stopTracking,
        verificationSession,
        closeVerificationProgressModal,
    ])

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
        async (source?: IframeCloseSource) => {
            setShowTosIframe(false)

            if (source === 'tos_accepted' || source === 'returned') {
                if (source === 'tos_accepted') posthog.capture(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED)
                // show loading state while confirming + polling
                setModalPhase('preparing')
                try {
                    const accepted = await confirmBridgeTosAndAwaitRails(fetchUser, {
                        observedAcceptance: source === 'tos_accepted',
                    })
                    if (source === 'returned') {
                        // `returned` carries no acceptance claim, so neither the
                        // analytics event nor the flow's completion can be taken
                        // on faith — Bridge's answer decides both. The recovery
                        // copy stays dismissal-shaped because this modal's error
                        // CTA closes the flow; the home ToS card owns the retry.
                        if (!accepted) {
                            setModalPhase('bridge_tos')
                            setTosError(
                                "The terms weren't accepted. You can accept them later from your activity feed."
                            )
                            return
                        }
                        posthog.capture(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED)
                    }
                    const refreshed = await fetchUser()
                    if (
                        deriveCapabilityPhaseSignals(
                            refreshed?.capabilities,
                            lastIntentRef.current ?? regionIntent,
                            requestedCountry
                        ).allSettled
                    )
                        completeFlow()
                    else {
                        setModalPhase('preparing')
                        setForceShowModal(true)
                    }
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
        [fetchUser, completeFlow, regionIntent, requestedCountry]
    )

    // handle modal close (Go to Home, etc.)
    const handleModalClose = useCallback(() => {
        const effectiveIntent = lastIntentRef.current ?? regionIntent
        posthog.capture(
            effectiveIntent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_ABANDONED : ANALYTICS_EVENTS.KYC_ABANDONED,
            { region_intent: effectiveIntent, phase: modalPhase }
        )
        isRealtimeFlowRef.current = false
        setForceShowModal(false)
        clearPreparingTimer()
        stopTracking()
        closeVerificationProgressModal()
    }, [clearPreparingTimer, stopTracking, closeVerificationProgressModal, regionIntent, modalPhase])

    // Deferring terms is a dismissal, never successful deposit readiness.
    const handleSkipTerms = handleModalClose

    // cleanup on unmount
    useEffect(() => {
        return () => {
            clearPreparingTimer()
            stopTracking()
        }
    }, [clearPreparingTimer, stopTracking])

    const isModalOpen = isVerificationProgressModalOpen || forceShowModal

    // Derive preparing stage from elapsed time for progressive copy
    const preparingStage = useMemo<'initial' | 'configuring' | 'slow'>(() => {
        if (preparingElapsed < 3) return 'initial'
        if (preparingElapsed < 8) return 'configuring'
        return 'slow'
    }, [preparingElapsed])

    const depositBlocked = !verificationSession && !showWrapper && allBlocked && modalPhase === 'preparing'

    return {
        // initiation
        handleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        handleFixableRejection,
        isLoading,
        error: error ?? (depositBlocked ? t('railsUnavailableError') : null),
        errorCooldown,
        dismissErrorCooldown,
        // terminal = the user has no action that changes the outcome; consumers
        // must suppress their retry CTA on it (TASK-21882)
        isTerminalError: isTerminalError || depositBlocked,
        liveKycStatus,

        verificationSession,
        showCorrection,
        correctVerificationData,
        dismissCorrection,
        // SDK wrapper
        showWrapper,
        accessToken,
        handleSdkClose: handleClose,
        handleSdkComplete,
        handleSdkSubmitted,
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
