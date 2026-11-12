import { railJurisdictionForBank } from '@/utils/bridge.utils'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useTranslations } from 'next-intl'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useSumsubReloadResume, type KycResumeState } from '@/hooks/useSumsubReloadResume'
import { useCapabilities } from '@/hooks/useCapabilities'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { RESIDENCE_ADDRESS_ACTION_KEY } from '@/constants/kyc.consts'
import { entryAction, reportEntry, UNKNOWN_REPORT } from '@/features/kyc-features/report'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import type { SumsubSubmissionSource } from '@/components/Kyc/sumsubSdk.types'
import { type KycModalPhase, type IUserProfile } from '@/interfaces/interfaces'
import { type FeatureReportEntry, type UserCapabilities } from '@/types/capabilities'
import type { KycCompletionNotice } from '@/components/Kyc/KycVerificationInProgressModal'
import { type KYCRegionIntent, type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const PREPARING_TIMEOUT_MS = 30000

/**
 * Phase-transition signals for the preparing → tos → complete orchestrator,
 * read from the API's feature report entry for the account the flow opens:
 * the target country's, else the intent's (LATAM the local account, EU the
 * euro one, NA the dollar one), else the bank feature.
 *
 *   - needsTos ← the entry's step is accepting Bridge's terms
 *   - anyPending ← the provider is setting it up, nothing for the user to do
 *   - notOpened ← nothing set up yet (the realtime flow reads it as still provisioning)
 *   - allSettled ← it moves money
 *   - allBlocked ← it is refused
 *   - completionNotice ← setup ends with an outstanding user action or provider review
 *   - supplementKey ← a provider asks for a proof-of-address supplement
 *   - supplementInReview ← the requested account is reviewing its supplement
 */
export function deriveCapabilityPhaseSignals(
    capabilities: UserCapabilities | undefined,
    intent?: KYCRegionIntent,
    targetCountry?: string
) {
    const report = capabilities?.features ?? UNKNOWN_REPORT
    const nextActions = capabilities?.nextActions ?? []
    const country =
        railJurisdictionForBank(targetCountry) ?? (intent === 'EU' ? 'EU' : intent === 'NA' ? 'US' : undefined)
    const entry = country
        ? reportEntry(report, 'deposit', { channel: 'bank', country })
        : intent === 'LATAM'
          ? report.local
          : reportEntry(report, 'deposit', { channel: 'bank' })
    const entries = [entry, report.bank, report.local, report.card]
    const noticeKind = (candidate: FeatureReportEntry): KycCompletionNotice['kind'] | null => {
        const action = entryAction(candidate, nextActions)
        if (
            candidate.state === 'setting_up' &&
            (action?.kind === 'wait' || candidate.reason === 'requirements_in_review')
        )
            return 'review'
        if (
            candidate.state === 'action_required' &&
            action &&
            !action.key.startsWith('supplement:') &&
            ['questions', 'sumsub', 'bridge-hosted', 'rain-hosted', 'provide-email'].includes(action.kind)
        )
            return 'action'
        return null
    }
    const kind = noticeKind(entry)
    const accounts = country
        ? Object.entries({ ...report.bank.accounts, ...report.local.accounts }).filter(
              ([, account]) => account === entry
          )
        : Object.entries(entry === report.local ? report.local.accounts : report.bank.accounts)
    const currencies = accounts.filter(([, account]) => noticeKind(account) === kind).map(([currency]) => currency)
    const completionNotice: KycCompletionNotice | null = kind ? { kind, currencies } : null
    return {
        needsTos: entryAction(entry, nextActions)?.kind === 'accept-tos',
        anyPending: entry.state === 'setting_up' || entry.state === 'pending',
        allBlocked: entry.state === 'refused',
        allSettled: entry.state === 'on',
        completionNotice,
        notOpened: entry.state === 'ready',
        supplementInReview: entry.reason === 'requirements_in_review',
        // A provider parked until a supplement collects what it needs (today Bridge's proof of address).
        supplementKey: entries.map((candidate) => candidate.action).find((key) => !!key?.startsWith('supplement:')),
    }
}

/**
 * Settles a Bridge ToS page that closed by itself: asks Bridge whether the
 * terms are signed, and when they are, records the acceptance and polls
 * fetchUser (max 3 × 2s) until the bank rails leave the ToS-required state.
 *
 * A page message can arrive before the provider has persisted the signature.
 * The API confirmation and a fresh capability read must both settle before a
 * caller resumes the account action.
 *
 * A manual exit never comes here: the confirm endpoint reads Bridge's
 * customer-level flag, which a user who signed the base terms already has, so
 * it cannot tell whether they signed the terms this page asked for.
 */
export async function resolveBridgeTosClose(
    fetchUser: () => Promise<IUserProfile | null>,
    source: Exclude<IframeCloseSource, 'manual'>,
    country?: string
): Promise<boolean> {
    let accepted = !!(await confirmBridgeTos()).data?.accepted
    if (!accepted) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        accepted = !!(await confirmBridgeTos()).data?.accepted
    }

    if (!accepted) return false

    posthog.capture(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED, { source })

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
        if (
            updatedUser?.capabilities &&
            !deriveCapabilityPhaseSignals(updatedUser.capabilities, undefined, country).needsTos
        )
            return true
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    return false
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
    /**
     * The SDK closed on a submitted action that is reviewed apart from the
     * identity (today the address step): the screen that offered it says what
     * happens next, so no progress modal opens.
     */
    onActionSubmitted?: (key: string) => void
    regionIntent?: KYCRegionIntent
    /** False where the page resumes its own Sumsub session from the shared `kyc` param. */
    resumeOnReload?: boolean
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
    onActionSubmitted,
    regionIntent,
    resumeOnReload = true,
}: UseMultiPhaseKycFlowOptions) => {
    const { fetchUser, user } = useAuth()
    const t = useTranslations('kyc')
    const acquisitionSource = user?.invitedBy ? 'referred' : 'organic'
    const { isTerminalFailure } = useIdentityVerification()
    const [showVerificationReview, setShowVerificationReview] = useState(false)
    // A final decision is one no new document can change: support reviews the account first (H9).
    const blockIfFinal = useCallback(() => {
        if (!isTerminalFailure) return false
        setShowVerificationReview(true)
        return true
    }, [isTerminalFailure])
    const dismissVerificationReview = useCallback(() => setShowVerificationReview(false), [])

    // multi-phase modal state
    const [modalPhase, setModalPhase] = useState<KycModalPhase>('verifying')
    const [forceShowModal, setForceShowModal] = useState(false)
    const [preparingTimedOut, setPreparingTimedOut] = useState(false)
    const [preparingElapsed, setPreparingElapsed] = useState(0)
    const [completionNotice, setCompletionNotice] = useState<KycCompletionNotice | null>(null)
    const completionNoticeRef = useRef<KycCompletionNotice | null>(null)
    const finishedRef = useRef(false)
    const flowGenerationRef = useRef(0)
    const completedSessionRef = useRef<string | null>(null)
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
    const requestedCountryRef = useRef<string | undefined>(undefined)

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
    const confirmedTosGeneration = useRef<number | null>(null)

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
    const {
        allSettled,
        needsTos,
        allBlocked,
        supplementKey,
        supplementInReview,
        completionNotice: nextNotice,
    } = useMemo(
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
        if (finishedRef.current) return
        finishedRef.current = true
        flowGenerationRef.current += 1
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
        setIsLoadingTos(false)
        clearPreparingTimer()
        stopTracking()
        closeVerificationModalRef.current()
        if (completionNoticeRef.current) onManualClose?.()
        else onKycSuccess?.()
    }, [onKycSuccess, onManualClose, clearPreparingTimer, stopTracking, regionIntent, acquisitionSource])

    const showCompletionNotice = useCallback(
        (notice: KycCompletionNotice) => {
            if (finishedRef.current) return
            completionNoticeRef.current = notice
            setCompletionNotice(notice)
            clearPreparingTimer()
            setPreparingTimedOut(false)
            setShowTosIframe(false)
            setModalPhase('complete')
            setForceShowModal(true)
        },
        [clearPreparingTimer]
    )

    const submittedSupplementsRef = useRef(new Set<string>())
    const [pendingSupplement, setPendingSupplement] = useState<string | null>(null)
    const askForSupplement = useCallback((key: string) => {
        setPendingSupplement(key)
        setModalPhase('supplement')
        setForceShowModal(true)
    }, [])

    // called when sumsub status transitions to APPROVED
    const handleSumsubApproved = useCallback(async () => {
        if (finishedRef.current || completionNoticeRef.current) return
        const generation = flowGenerationRef.current
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

        let updatedUser: IUserProfile | null
        try {
            updatedUser = await fetchUser()
        } catch {
            if (generation !== flowGenerationRef.current) return
            setModalPhase('preparing')
            setForceShowModal(true)
            setPreparingTimedOut(true)
            return
        }
        if (generation !== flowGenerationRef.current || completionNoticeRef.current) return
        // post-approval branching reads the FRESH capability block from this
        // fetchUser() result (not the reactive useCapabilities() snapshot,
        // which would be stale within this synchronous call).
        const {
            needsTos,
            anyPending,
            notOpened,
            allSettled,
            supplementKey: freshSupplementKey,
            supplementInReview: freshSupplementInReview,
            completionNotice: freshNotice,
        } = deriveCapabilityPhaseSignals(
            updatedUser?.capabilities,
            lastIntentRef.current ?? regionIntent,
            requestedCountryRef.current
        )

        if (needsTos) {
            setModalPhase('bridge_tos')
            setForceShowModal(true)
            clearPreparingTimer()
            return
        }

        if (freshNotice) {
            showCompletionNotice(freshNotice)
            return
        }

        if (freshSupplementKey) {
            clearPreparingTimer()
            // Submitted in this flow: it is in review, and the rail stays parked until it is approved.
            if (submittedSupplementsRef.current.has(freshSupplementKey)) completeFlow()
            else askForSupplement(freshSupplementKey)
            return
        }

        if (freshSupplementInReview) {
            clearPreparingTimer()
            completeFlow()
            return
        }

        if (anyPending || (notOpened && isRealtimeFlowRef.current)) {
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
    }, [
        fetchUser,
        startTracking,
        clearPreparingTimer,
        completeFlow,
        askForSupplement,
        onKycApproved,
        regionIntent,
        showCompletionNotice,
    ])

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
        handleResidenceChange,
        handleSelfHealResubmit,
        handleStartAction,
        getActionKey,
        isProviderRequest,
        handleFixableRejection,
        handleFixableGate,
        handleSdkSubmitted: originalHandleSdkSubmitted,
        handleSdkComplete: originalHandleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        isActionFlow,
        isResidenceChangeFlow,
        isMultiLevel,
        documentConfig,
        documentAttemptId,
        verificationSession,
        showCorrection,
        taxIdCorrection,
        correctVerificationData,
        dismissCorrection,
    } = useSumsubKycFlow({
        onKycSuccess: handleSumsubApproved,
        onManualClose,
        regionIntent,
    })

    const [submissionAttempt, setSubmissionAttempt] = useState(() => ({
        id: 0,
        intent: regionIntent,
        residence: isResidenceChangeFlow,
    }))
    const reportedAttemptsRef = useRef(new Set<number>())
    // Every SDK opening (initiate, restart, correction, self-heal, start-action) is a fresh attempt.
    // Set during render so the SDK launch effect in the same commit binds to the new attempt.
    const [attemptWrapperOpen, setAttemptWrapperOpen] = useState(showWrapper)
    if (showWrapper !== attemptWrapperOpen) {
        setAttemptWrapperOpen(showWrapper)
        if (showWrapper) {
            flowGenerationRef.current += 1
            finishedRef.current = false
            completionNoticeRef.current = null
            completedSessionRef.current = null
            setCompletionNotice(null)
            setSubmissionAttempt((attempt) => ({
                id: attempt.id + 1,
                intent: attempt.intent,
                residence: isResidenceChangeFlow,
            }))
        }
    }

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

    // Retain the attempt in late SDK callbacks so they cannot consume a newer attempt's submission.
    // A residence change is an action on an approved identity, never an identity submission.
    const captureSubmission = useCallback(
        (source: SumsubSubmissionSource | 'sdk_complete') => {
            if (submissionAttempt.residence || reportedAttemptsRef.current.has(submissionAttempt.id)) return
            reportedAttemptsRef.current.add(submissionAttempt.id)
            posthog.capture(ANALYTICS_EVENTS.KYC_SUBMITTED, {
                region_intent: submissionAttempt.intent,
                submit_source: source,
            })
        },
        [submissionAttempt]
    )

    const isArgentinaSingleLevelSession =
        verificationSession?.targetCountry === 'AR' && !verificationSession.isMultiLevel && !isMultiLevel

    const handleSdkSubmitted = useCallback(
        (source: SumsubSubmissionSource = 'sdk_submitted') => {
            originalHandleSdkSubmitted()
            reportedRejectionRef.current = null
            // The address step is not an identity submission (handleSdkComplete reports it).
            if (getActionKey() === RESIDENCE_ADDRESS_ACTION_KEY) return
            captureSubmission(source)
            if (source !== 'sdk_teardown' && isArgentinaSingleLevelSession) {
                originalHandleSdkComplete()
                setModalPhase('submitted')
            }
        },
        [
            captureSubmission,
            isArgentinaSingleLevelSession,
            originalHandleSdkComplete,
            originalHandleSdkSubmitted,
            getActionKey,
        ]
    )

    // wrap handleSdkComplete to track real-time flow
    const handleSdkComplete = useCallback(() => {
        reportedRejectionRef.current = null
        // Not an identity submission: no KYC_SUBMITTED, no approval to wait for.
        if (getActionKey() === RESIDENCE_ADDRESS_ACTION_KEY) {
            originalHandleSdkComplete()
            markSubmitted()
            onActionSubmitted?.(RESIDENCE_ADDRESS_ACTION_KEY)
            return
        }
        if (!isResidenceChangeFlow) {
            captureSubmission('sdk_complete')
            isRealtimeFlowRef.current = true
        }
        // Deliberately does NOT consume a deferred ACTION_REQUIRED for the capture
        // effect. On native this callback is ambiguous in a multi-level session:
        // SumsubNativeSdk marks Pending as submitted, so a Level-1 submit followed
        // by backing out of Level 2 arrives here exactly like a real completion.
        // Suppressing the capture and the user-store refresh on that path would
        // strand the applicant on a stale progress modal. (originalHandleSdkComplete
        // still consumes for the sibling transition effect — pre-existing, and the
        // same ambiguity applies to it.)
        const completedAction = getActionKey()
        if (completedAction?.startsWith('supplement:')) submittedSupplementsRef.current.add(completedAction)
        originalHandleSdkComplete()
        // Residence submission only puts the dedicated action into provider
        // review. The approved identity and its rails remain authoritative
        // until a matching GREEN webhook promotes the new residence, so there
        // is no post-approval rail orchestration to start here.
        if (isResidenceChangeFlow) return
        // for action flows (manteca, self-heal), the base status is already APPROVED
        // and won't transition — directly start the preparing/tracking phase
        if (isActionFlow && !verificationSession) {
            handleSumsubApproved()
        }
    }, [
        originalHandleSdkComplete,
        getActionKey,
        handleSumsubApproved,
        isActionFlow,
        isResidenceChangeFlow,
        captureSubmission,
        verificationSession,
        onActionSubmitted,
    ])

    // Existing Android PWAs can cold-reload after opening the camera or gallery.
    // Keep the exact initiate arguments so the same applicant flow can reopen
    // until installed PWAs are blocked at the native migration cutoff.
    const resumingRef = useRef(false)
    const lastInitiateArgsRef = useRef<KycResumeState>({})

    // wrap handleInitiateKyc to reset state for new attempts
    const handleInitiateKyc = useCallback(
        async (
            overrideIntent?: KYCRegionIntent,
            levelName?: string,
            crossRegion?: boolean,
            targetCountry?: string,
            corridor?: DepositCorridor
        ) => {
            if (blockIfFinal()) return false
            const intent = overrideIntent ?? regionIntent
            flowGenerationRef.current += 1
            finishedRef.current = false
            completionNoticeRef.current = null
            completedSessionRef.current = null
            setCompletionNotice(null)
            setSubmissionAttempt((attempt) => ({ id: attempt.id + 1, intent, residence: false }))
            lastIntentRef.current = intent
            setRequestedIntent(intent)
            lastInitiateArgsRef.current = { intent, levelName, crossRegion, targetCountry, corridor }
            posthog.capture(
                intent === 'LATAM' ? ANALYTICS_EVENTS.MANTECA_KYC_INITIATED : ANALYTICS_EVENTS.KYC_INITIATED,
                { region_intent: intent, acquisition_source: acquisitionSource, resumed: resumingRef.current }
            )

            requestedCountryRef.current = targetCountry?.toUpperCase()
            setRequestedCountry(requestedCountryRef.current)
            setModalPhase('verifying')
            setForceShowModal(false)
            setPreparingTimedOut(false)
            setTosLink(null)
            setShowTosIframe(false)
            setTosError(null)
            setIsLoadingTos(false)
            isRealtimeFlowRef.current = false
            clearPreparingTimer()

            return originalHandleInitiateKyc(
                overrideIntent,
                levelName,
                crossRegion,
                targetCountry,
                false,
                corridor,
                !resumingRef.current
            )
        },
        [originalHandleInitiateKyc, clearPreparingTimer, regionIntent, acquisitionSource, blockIfFinal]
    )

    useSumsubReloadResume(
        showWrapper ? lastInitiateArgsRef.current : null,
        async (state) => {
            resumingRef.current = true
            const opened = await handleInitiateKyc(
                state.intent,
                state.levelName,
                state.crossRegion,
                state.targetCountry,
                state.corridor
            )
            resumingRef.current = false
            return !!opened
        },
        resumeOnReload
    )

    // 30s timeout for preparing phase + elapsed time counter for progressive copy
    useEffect(() => {
        if (modalPhase === 'preparing' && (isVerificationProgressModalOpen || forceShowModal) && !preparingTimedOut) {
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
    }, [modalPhase, preparingTimedOut, clearPreparingTimer, isVerificationProgressModalOpen, forceShowModal])

    const sessionId = verificationSession?.id
    const sessionGeneration = verificationSession?.generation
    const sessionState = verificationSession?.state
    const sessionCountry = verificationSession?.targetCountry
    useEffect(() => {
        if (!sessionId) return
        if (sessionState === 'CORRECTION_REQUIRED' || sessionState === 'BLOCKED') {
            setModalPhase('verifying')
            setForceShowModal(false)
            clearPreparingTimer()
            return
        }
        if (!isVerificationProgressModalOpen) return
        if (isArgentinaSingleLevelSession) {
            setModalPhase('submitted')
            clearPreparingTimer()
            if (sessionState !== 'READY') return
        } else {
            if (!completionNoticeRef.current) setModalPhase('preparing')
            if (sessionState !== 'READY' && sessionState !== 'PROVIDER_PENDING') return
        }
        const key = `${sessionId}:${sessionGeneration}`
        if (completedSessionRef.current === key) return
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const refreshBeforeCompletion = async () => {
            markSubmitted()
            try {
                const refreshed = await fetchUser()
                if (cancelled) return
                const signals = deriveCapabilityPhaseSignals(refreshed?.capabilities, 'LATAM', sessionCountry)
                if (!isArgentinaSingleLevelSession && signals.completionNotice) {
                    completedSessionRef.current = key
                    showCompletionNotice(signals.completionNotice)
                    return
                }
                if (
                    sessionState === 'READY' &&
                    (isArgentinaSingleLevelSession
                        ? refreshed?.capabilities?.features?.local.accounts.ARS?.state === 'on'
                        : signals.allSettled)
                ) {
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
        isArgentinaSingleLevelSession,
        isVerificationProgressModalOpen,
        fetchUser,
        completeFlow,
        clearPreparingTimer,
        showCompletionNotice,
    ])

    // phase transitions driven by rail tracking
    useEffect(() => {
        if (verificationSession) return
        if (!isVerificationProgressModalOpen && !forceShowModal) return
        if (nextNotice && (modalPhase === 'preparing' || modalPhase === 'bridge_tos')) {
            showCompletionNotice(nextNotice)
            return
        }
        if (modalPhase === 'preparing') {
            if (supplementInReview && !supplementKey) {
                clearPreparingTimer()
                completeFlow()
                return
            }
            if (supplementKey) {
                clearPreparingTimer()
                if (submittedSupplementsRef.current.has(supplementKey)) completeFlow()
                else askForSupplement(supplementKey)
                return
            }
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
        supplementKey,
        supplementInReview,
        completeFlow,
        askForSupplement,
        clearPreparingTimer,
        stopTracking,
        verificationSession,
        closeVerificationProgressModal,
        nextNotice,
        showCompletionNotice,
        isVerificationProgressModalOpen,
        forceShowModal,
    ])

    // handle "Accept Terms" click in bridge_tos phase
    const handleAcceptTerms = useCallback(async () => {
        const generation = flowGenerationRef.current
        setIsLoadingTos(true)
        setTosError(null)

        try {
            const response = await getBridgeTosLink()
            if (generation !== flowGenerationRef.current) return

            if (response.error || !response.data?.tosLink) {
                setTosError(
                    response.error || 'Could not load terms. You can accept them later from your activity feed.'
                )
                return
            }

            setTosLink(response.data.tosLink)
            confirmedTosGeneration.current = null
            setShowTosIframe(true)
            posthog.capture(ANALYTICS_EVENTS.KYC_TOS_OPENED)
        } catch (error) {
            if (generation !== flowGenerationRef.current) return
            Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_open' } })
            setTosError('Something went wrong. You can accept terms later from your activity feed.')
        } finally {
            if (generation === flowGenerationRef.current) setIsLoadingTos(false)
        }
    }, [])

    // handle ToS iframe close
    const handleTosIframeClose = useCallback(
        async (source: IframeCloseSource = 'manual') => {
            if (finishedRef.current || completionNoticeRef.current) return
            const generation = flowGenerationRef.current
            setShowTosIframe(false)

            // a manual exit stays on the bridge_tos phase (user can try again)
            if (source === 'manual') return
            if (confirmedTosGeneration.current === generation) return
            confirmedTosGeneration.current = generation

            // show loading state while confirming + polling
            setModalPhase('preparing')
            try {
                const intent = lastIntentRef.current ?? regionIntent
                const country = requestedCountry ?? (intent === 'NA' ? 'US' : intent === 'EU' ? 'EU' : undefined)
                const accepted = await resolveBridgeTosClose(fetchUser, source, country)
                if (generation !== flowGenerationRef.current || completionNoticeRef.current) return
                if (!accepted) {
                    if (source === 'tos_accepted') {
                        setPreparingTimedOut(true)
                        return
                    }
                    // The page closed by itself without a signature. The copy
                    // stays dismissal-shaped because this modal's error CTA
                    // closes the flow; the home ToS card owns the retry.
                    setModalPhase('bridge_tos')
                    setTosError("The terms weren't accepted. You can accept them later from your activity feed.")
                    return
                }
                const refreshed = await fetchUser()
                if (generation !== flowGenerationRef.current || completionNoticeRef.current) return
                const signals = deriveCapabilityPhaseSignals(
                    refreshed?.capabilities,
                    lastIntentRef.current ?? regionIntent,
                    requestedCountry
                )
                if (signals.completionNotice) showCompletionNotice(signals.completionNotice)
                else if (signals.allSettled) completeFlow()
                else {
                    setModalPhase('preparing')
                    setForceShowModal(true)
                }
            } catch (error) {
                if (generation !== flowGenerationRef.current || completionNoticeRef.current) return
                Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_confirm' } })
                // Don't leave the modal frozen on 'preparing' with no feedback
                // if the confirm POST / rails poll throws — surface the
                // timed-out recovery state immediately instead of a ~30s dead
                // modal. (BridgeTosStep wraps the same call in try/catch.)
                setPreparingTimedOut(true)
            }
        },
        [fetchUser, completeFlow, regionIntent, requestedCountry, showCompletionNotice]
    )

    // handle modal close (Go to Home, etc.)
    const handleModalClose = useCallback(() => {
        if (completionNoticeRef.current) {
            completeFlow()
            return
        }
        flowGenerationRef.current += 1
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
    }, [clearPreparingTimer, stopTracking, closeVerificationProgressModal, regionIntent, modalPhase, completeFlow])

    // Deferring terms is a dismissal, never successful deposit readiness.
    const handleSkipTerms = handleModalClose

    // The proof of address opens on the supplement action the parked rail names.
    const handleStartSupplement = useCallback(async () => {
        if (!pendingSupplement) return
        setForceShowModal(false)
        setModalPhase('verifying')
        clearPreparingTimer()
        await handleStartAction(pendingSupplement)
    }, [pendingSupplement, clearPreparingTimer, handleStartAction])

    // Deferring it is a dismissal too: the rail keeps asking wherever it shows.
    const handleSkipSupplement = useCallback(() => {
        handleModalClose()
        setModalPhase('verifying')
    }, [handleModalClose])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            flowGenerationRef.current += 1
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

    const depositBlocked =
        !verificationSession && !showWrapper && allBlocked && !supplementKey && modalPhase === 'preparing'

    return {
        // initiation
        handleInitiateKyc,
        blockIfFinal,
        showVerificationReview,
        dismissVerificationReview,
        handleRestartIdentity,
        handleResidenceChange,
        handleSelfHealResubmit,
        handleStartAction,
        isProviderRequest,
        handleFixableRejection,
        handleFixableGate,
        isLoading,
        error: error ?? (depositBlocked ? t('railsUnavailableError') : null),
        errorCooldown,
        dismissErrorCooldown,
        // terminal = the user has no action that changes the outcome; consumers
        // must suppress their retry CTA on it (TASK-21882)
        isTerminalError: isTerminalError || depositBlocked,
        liveKycStatus,

        documentConfig,
        documentAttemptId,
        verificationSession,
        showCorrection,
        taxIdCorrection,
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
        handleStartSupplement,
        handleSkipSupplement,
        completeFlow,
        tosError,
        isLoadingTos,
        preparingTimedOut,
        preparingStage,
        completionNotice,

        // ToS iframe
        tosLink,
        showTosIframe,
        handleTosIframeClose,
    }
}
