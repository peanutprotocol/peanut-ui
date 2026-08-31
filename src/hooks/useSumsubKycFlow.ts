import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import {
    initiateSumsubKyc,
    initiateSelfHealResubmission,
    restartIdentityVerification,
    startKycAction,
    isTerminalActionCode,
    type SumsubActionErrorCode,
} from '@/app/actions/sumsub'
import { type KYCRegionIntent, type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { isDemoMode } from '@/utils/demo'

interface UseSumsubKycFlowOptions {
    onKycSuccess?: () => void
    onManualClose?: () => void
    regionIntent?: KYCRegionIntent
}

// Time-escalating schedule for the verification-progress-modal status poll.
// initiateSumsubKyc is a MUTATING endpoint — for approved-LATAM users in the
// self-recovery state each call re-runs a full provider submission. A fixed 5s
// interval hammered it for the entire modal-open (incident 2026-07-02: 86
// re-submissions in 20 min for one user). We keep the fast 5s cadence only for
// the first minute (the common quick transition), then back off. The backoff is
// purely time-based, NOT error-based: the poll returns HTTP 200 even when the
// backend reprocess fails, so an error count would never escalate.
const KYC_POLL_SCHEDULE: ReadonlyArray<{ untilMs: number; delayMs: number }> = [
    { untilMs: 60_000, delayMs: 5_000 }, // first ~1 min: fast path for the common quick transition
    { untilMs: 120_000, delayMs: 10_000 },
    { untilMs: 180_000, delayMs: 20_000 },
]
// After the escalation schedule the poll settles at this steady cadence for as
// long as the modal stays open. It does NOT stop: a missed websocket event
// (laptop sleep, mobile background, network switch) can land at any time during
// a long manual review, and a hard stop would strand the user on "Almost there"
// forever with onKycSuccess never firing. The 60s floor plus the backend's own
// self-recovery cooldown (which short-circuits repeat submissions server-side)
// keeps the steady poll cheap — nothing like the fixed-5s battering ram this
// schedule replaced.
const KYC_POLL_MAX_DELAY_MS = 60_000

/** `code` from a sumsub action's canned English fallback → kyc.* catalog key.
 *  Backend prose arrives without a code and renders as-is (#2554).
 *
 *  Partial on purpose: a code with no catalog entry keeps the backend's own
 *  message, which is what we want for refusals the backend explains better
 *  than a generic string could (an unsupported country names the country). */
const ACTION_ERROR_KEYS = {
    initiate_failed: 'errorInitiateFailed',
    restart_failed: 'errorRestartFailed',
    resubmit_failed: 'errorResubmitFailed',
    start_action_failed: 'errorStartActionFailed',
    invalid_response: 'errorInvalidResponse',
    unexpected: 'unexpectedError',
} as const satisfies Partial<Record<SumsubActionErrorCode, string>>

/**
 * A workflow is multi-level when Sumsub can show a SECOND level in the same
 * session, after the first submit:
 *   - LATAM → `general`, which branches AR/BR applicants to `manteca-requirements`
 *   - EU → `bridge-requirements`, which branches EEA applicants to the
 *     `bridge-eea-uplift` questionnaire
 *
 * NA is deliberately NOT here, even though it shares the `bridge-requirements`
 * workflow. NA second levels exist but are rare organic branches — the workflow
 * routes to `source-of-funds` (applicant age >= 60) and `proof-of-address` (POI
 * country in the higher-risk list); see peanut-api-ts `level-registry.ts`.
 * Marking NA multi-level would hold EVERY US applicant in an open SDK on
 * Sumsub's "documents submitted" screen until approval to serve those rare
 * branches. The branch cohort gets the ACTION_REQUIRED drawer round-trip
 * instead, which converges. EU differs: every EEA applicant branches to the
 * uplift questionnaire, so the hold serves the whole cohort.
 *
 * ROW and STANDARD are single-level. Applicant actions are always single-level,
 * whatever the region — see the `isActionFlow` check at the initiate open.
 *
 * This list is hand-rolled workflow knowledge and will drift. The durable fix is
 * for the initiate response to report the level / multi-level flag itself.
 */
const isMultiLevelIntent = (intent: KYCRegionIntent | undefined): boolean => intent === 'LATAM' || intent === 'EU'

const getKycPollDelayMs = (elapsedMs: number): number => {
    for (const { untilMs, delayMs } of KYC_POLL_SCHEDULE) {
        if (elapsedMs < untilMs) return delayMs
    }
    return KYC_POLL_MAX_DELAY_MS
}

export const useSumsubKycFlow = ({ onKycSuccess, onManualClose, regionIntent }: UseSumsubKycFlowOptions = {}) => {
    const { user } = useUserStore()
    const router = useRouter()
    const t = useTranslations('kyc')

    // Localize a failed action result: known codes map onto catalog copy,
    // codeless results keep the backend's display-ready prose.
    const actionErrorMessage = useCallback(
        (result: { error?: string; code?: SumsubActionErrorCode }): string | null =>
            (result.code && result.code in ACTION_ERROR_KEYS
                ? t(ACTION_ERROR_KEYS[result.code as keyof typeof ACTION_ERROR_KEYS])
                : result.error) ?? null,
        [t]
    )

    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [showWrapper, setShowWrapper] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Some initiate failures are terminal: the user has no action that could
    // change the outcome, so offering a retry is worse than offering nothing.
    // Callers must suppress their retry CTA on this rather than inferring
    // retriability from the region, which cannot tell the two apart.
    const [isTerminalError, setIsTerminalError] = useState(false)
    const [isVerificationProgressModalOpen, setIsVerificationProgressModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<SumsubKycStatus | undefined>(undefined)
    const [rejectLabels, setRejectLabels] = useState<string[] | undefined>(undefined)
    // true when the SDK is showing an applicant action (not a standard level)
    const [isActionFlow, setIsActionFlow] = useState(false)
    // true when the open SDK session runs a multi-level workflow, so the SDK must
    // stay open past the first submit and show the follow-up level. Raised by the
    // initiate open (the only path that can start one) and cleared by both close
    // handlers, so "closed" always means false. It depends on the intent that open
    // actually used — most entry points pass it to handleInitiateKyc rather than
    // as the `regionIntent` prop, so the prop alone is not the effective intent.
    const [isMultiLevel, setIsMultiLevel] = useState(false)
    const prevStatusRef = useRef(liveKycStatus)
    const showWrapperRef = useRef(showWrapper)
    showWrapperRef.current = showWrapper
    // tracks the effective region intent across initiate + refresh so the correct template is always used
    const regionIntentRef = useRef<KYCRegionIntent | undefined>(regionIntent)
    // tracks the level name across initiate + refresh (e.g. 'peanut-additional-docs')
    const levelNameRef = useRef<string | undefined>(undefined)
    // tracks the selected target country across initiate + refresh for country-scoped Manteca actions
    const targetCountryRef = useRef<string | undefined>(undefined)
    // guards fetchCurrentStatus from running while handleInitiateKyc is in progress
    const initiatingRef = useRef(false)
    // guard: only fire onKycSuccess when the user initiated a kyc flow in this session.
    // prevents stale websocket events or mount-time fetches from auto-closing the drawer.
    const userInitiatedRef = useRef(false)
    // tracks self-heal provider for token refresh — null when in regular KYC flow
    const selfHealProviderRef = useRef<'BRIDGE' | 'MANTECA' | null>(null)
    // The capability nextAction key behind an in-flight start-action flow.
    // Mutually exclusive with selfHealProviderRef, and needed by refreshToken:
    // POST /users/identity ignores levelName and no-ops for an already-approved
    // user, so an RFI token can only be re-minted through start-action.
    const actionKeyRef = useRef<string | null>(null)

    useEffect(() => {
        regionIntentRef.current = regionIntent
    }, [regionIntent])

    // listen for sumsub kyc status updates via websocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onSumsubKycStatusUpdate: (newStatus, newRejectLabels) => {
            setLiveKycStatus(newStatus as SumsubKycStatus)
            if (newRejectLabels) setRejectLabels(newRejectLabels)
        },
    })

    // react to status transitions
    useEffect(() => {
        // Hold an ACTION_REQUIRED transition while a multi-level SDK session is
        // open: the follow-up questionnaire IS the required action, so acting on it
        // here would tear the flow down under the user.
        //
        // This returns BEFORE prevStatusRef is advanced, so the transition is
        // deferred, not consumed. When the SDK closes, `showWrapper` changes, this
        // effect re-runs and the branches below evaluate the same transition for
        // real. Advancing the ref first would swallow it: a user who abandoned
        // mid-questionnaire (the SDK can sit on top of an open progress modal)
        // would then sit on a stale "verifying" modal forever.
        //
        // The one close that must NOT replay it is a submission — the user just
        // acted, so the held transition is stale for what they submitted.
        // handleSdkComplete consumes it by advancing prevStatusRef itself.
        //
        // Both flags are committed state rather than refs, so an interrupted render
        // can never leak a value this guard acts on.
        if (liveKycStatus === 'ACTION_REQUIRED' && showWrapper && isMultiLevel) return

        const prevStatus = prevStatusRef.current
        prevStatusRef.current = liveKycStatus

        if (prevStatus !== 'APPROVED' && liveKycStatus === 'APPROVED') {
            // if SDK is still open (multi-level), close it now —
            // applicantWorkflowCompleted has fired, all levels are done.
            if (showWrapperRef.current) {
                setShowWrapper(false)
                // this is the third and last path that closes the SDK, so clearing
                // here is what makes "closed ⇒ single-level" hold everywhere. A
                // later action open (self-heal, restart-identity, start-action)
                // would otherwise inherit a stale true and never close on submit.
                setIsMultiLevel(false)
                setIsVerificationProgressModalOpen(true)
                userInitiatedRef.current = true
            }
            if (userInitiatedRef.current) {
                onKycSuccess?.()
            }
        } else if (
            liveKycStatus &&
            liveKycStatus !== prevStatus &&
            liveKycStatus !== 'APPROVED' &&
            liveKycStatus !== 'PENDING' &&
            liveKycStatus !== 'REVERIFYING'
        ) {
            // close modal for any non-success terminal state (REJECTED, ACTION_REQUIRED, FAILED, etc.)
            setIsVerificationProgressModalOpen(false)
        }
    }, [liveKycStatus, onKycSuccess, showWrapper, isMultiLevel])

    // fetch current status to recover from missed websocket events.
    // skip when regionIntent is undefined to avoid creating an applicant with the wrong template
    // (e.g. RegionsVerification mounts with no region selected yet).
    useEffect(() => {
        if (!regionIntent) return
        // skip if handleInitiateKyc is already in progress — it handles status sync itself
        if (initiatingRef.current) return
        // skip if user already initiated a flow in this session — the SDK or
        // handleInitiateKyc manages status from here. without this guard,
        // the async fetch can resolve after initiatingRef is reset but before
        // showWrapperRef is updated by the batched render, causing a false
        // APPROVED transition that closes the SDK.
        if (userInitiatedRef.current) return

        const fetchCurrentStatus = async () => {
            try {
                const response = await initiateSumsubKyc({ regionIntent })
                if (response.data?.status && !initiatingRef.current && !showWrapperRef.current) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent failure - we just show the user an error when they try to initiate the kyc flow if the api call is failing
            }
        }

        fetchCurrentStatus()
    }, [regionIntent])

    // polling fallback for missed websocket events. while the verification
    // progress modal is open, re-check status on a time-escalating schedule
    // (KYC_POLL_SCHEDULE) so the flow can transition even if the websocket event
    // never arrives — without hammering the mutating initiate endpoint. A
    // self-rescheduling setTimeout chain (rather than a fixed setInterval) lets
    // the delay grow as the modal stays open, settling at a steady 60s cadence —
    // it keeps polling for the whole modal-open lifetime so a late/missed
    // websocket event is always eventually recovered.
    useEffect(() => {
        if (!isVerificationProgressModalOpen) return

        const startedAt = Date.now()
        let timeoutId: ReturnType<typeof setTimeout>
        let cancelled = false

        const pollStatus = async () => {
            try {
                const response = await initiateSumsubKyc({
                    regionIntent: regionIntentRef.current,
                    levelName: levelNameRef.current,
                    targetCountry: targetCountryRef.current,
                })
                if (response.data?.status) {
                    setLiveKycStatus(response.data.status)
                }
            } catch {
                // silent — polling is a best-effort fallback
            }
        }

        const scheduleNext = () => {
            const elapsed = Date.now() - startedAt
            timeoutId = setTimeout(async () => {
                await pollStatus()
                // the modal may have closed (cleanup ran) while the poll was in
                // flight — don't re-arm a timer after teardown.
                if (cancelled) return
                scheduleNext()
            }, getKycPollDelayMs(elapsed))
        }

        scheduleNext()
        return () => {
            cancelled = true
            clearTimeout(timeoutId)
        }
    }, [isVerificationProgressModalOpen])

    const handleInitiateKyc = useCallback(
        async (
            overrideIntent?: KYCRegionIntent,
            levelName?: string,
            crossRegion?: boolean,
            rawTargetCountry?: string
        ) => {
            // targetCountry is only ever consumed by the BE as a Manteca geo
            // (pendingMantecaGeo stamp + action externalId suffix). Call sites
            // pass the raw destination country for EVERY `latam`-region country
            // (MX, CL, …), but Manteca only serves AR/BR — an unsupported stamp
            // poisons the verification metadata (first-write-wins) and bails
            // every later geo resolution, so drop it at this choke point.
            // demo mode: skip Sumsub, treat KYC as complete.
            if (isDemoMode()) {
                onKycSuccess?.()
                return
            }

            const normalizedTargetCountry = rawTargetCountry?.toUpperCase()
            const targetCountry =
                normalizedTargetCountry && isMantecaSupportedCountryCode(normalizedTargetCountry)
                    ? normalizedTargetCountry
                    : undefined
            userInitiatedRef.current = true
            initiatingRef.current = true
            selfHealProviderRef.current = null
            actionKeyRef.current = null
            setIsLoading(true)
            setError(null)
            setIsTerminalError(false)

            // for cross-region: pre-set prevStatusRef to APPROVED so the fetchCurrentStatus
            // effect (which also fires when regionIntent changes) doesn't trigger onKycSuccess
            // when it sees the existing APPROVED status. save previous value to restore on failure.
            const savedPrevStatus = prevStatusRef.current
            if (crossRegion) {
                prevStatusRef.current = 'APPROVED'
            }

            try {
                const response = await initiateSumsubKyc({
                    regionIntent: overrideIntent ?? regionIntent,
                    levelName,
                    crossRegion,
                    targetCountry,
                })

                // A refusal no retry can change — no resolvable country for this
                // entry point, or a permanent restriction like Manteca's
                // US-nationality rule. Retrying sends the identical request and
                // gets the identical answer, so mark it terminal and let the
                // modal offer support instead of a button that cannot work.
                if (isTerminalActionCode(response.code)) {
                    userInitiatedRef.current = false
                    setIsTerminalError(true)
                    setError(response.error || t('errorInitiateFailed'))
                    return false
                }

                if (response.error) {
                    // same race the unsupported-region branch closes below: restoring
                    // prevStatusRef while leaving userInitiatedRef set lets a late/stale
                    // websocket APPROVED event fire onKycSuccess on top of this error.
                    // every terminal-error exit must clear the user-initiated guard.
                    userInitiatedRef.current = false
                    if (crossRegion) prevStatusRef.current = savedPrevStatus
                    setError(actionErrorMessage(response))
                    return false
                }

                // cross-region into a region no first-party bank provider serves (ROW).
                // the backend approved identity but can't auto-enroll any rail, so it
                // signals 'unsupported-region' (status APPROVED, no token) instead of a
                // silent no-op. surface an honest, terminal message and bail BEFORE the
                // status sync below — syncing APPROVED here would trip the transition
                // effect into firing onKycSuccess, looping the user back to "all set".
                //
                // clear userInitiatedRef so a late/stale websocket APPROVED event can't
                // satisfy the transition-effect guard and fire onKycSuccess after this
                // terminal error (the user is approved but has no rail — NOT a success).
                if (response.data?.actionType === 'unsupported-region') {
                    userInitiatedRef.current = false
                    setIsTerminalError(true)
                    setError(t('unsupportedRegionError'))
                    setIsTerminalError(true)
                    return false
                }

                // sync status from api response, but skip when a token is returned
                // alongside APPROVED — that means the SDK should open (e.g. additional-docs flow),
                // not that kyc is finished. syncing APPROVED here would trigger the useEffect
                // which fires onKycSuccess and closes everything before the SDK opens.
                if (response.data?.status && !(response.data.status === 'APPROVED' && response.data.token)) {
                    setLiveKycStatus(response.data.status)
                }

                // update effective intent + level for token refresh
                const effectiveIntent = overrideIntent ?? regionIntent
                if (effectiveIntent) regionIntentRef.current = effectiveIntent
                levelNameRef.current = levelName
                targetCountryRef.current = targetCountry

                // cross-region: bridge-direct means no SDK needed — backend is handling
                // rail enrollment + submission. go straight to the post-approval flow.
                if (response.data?.actionType === 'bridge-direct') {
                    prevStatusRef.current = 'APPROVED'
                    userInitiatedRef.current = true
                    setIsActionFlow(false)
                    setIsVerificationProgressModalOpen(true)
                    onKycSuccess?.()
                    return false
                }

                // approved, but every rail for this region is dead — a payload-build
                // failure can mark all four Bridge rails FAILED at once, and nothing
                // in the product re-enables them. Identical on the wire to "you're
                // done" until the backend started saying so, which is why a stranded
                // user pressed Verify, saw no SDK, no error and nothing at all, and
                // support told them to press it again (TASK-21882). Same shape as
                // 'unsupported-region' above: bail terminally, before the status sync.
                if (response.data?.actionType === 'rails-unavailable') {
                    userInitiatedRef.current = false
                    setIsTerminalError(true)
                    setError(t('railsUnavailableError'))
                    setIsTerminalError(true)
                    return false
                }

                // if already approved (or reverifying) and no token returned, kyc is done.
                // set prevStatusRef so the transition effect doesn't fire onKycSuccess a second time.
                // when a token IS returned (e.g. cross-region action or additional-docs), we still need to show the SDK.
                const status = response.data?.status
                if ((status === 'APPROVED' || status === 'REVERIFYING') && !response.data?.token) {
                    prevStatusRef.current = status
                    onKycSuccess?.()
                    return false
                }

                if (response.data?.token) {
                    // Native included: SumsubKycWrapper picks the Cordova SDK over
                    // the WebSDK by platform, so every flow that mints a token —
                    // not just this one — reaches the right SDK.
                    setAccessToken(response.data.token)
                    setIsActionFlow(!!response.data.actionType)
                    setIsMultiLevel(!response.data.actionType && isMultiLevelIntent(effectiveIntent))
                    setShowWrapper(true)
                    return true
                } else {
                    userInitiatedRef.current = false
                    setError(t('errorInitiateFailed'))
                    return false
                }
            } catch (e: unknown) {
                userInitiatedRef.current = false
                if (crossRegion) prevStatusRef.current = savedPrevStatus
                const message = e instanceof Error ? e.message : t('unexpectedError')
                setError(message)
                return false
            } finally {
                setIsLoading(false)
                initiatingRef.current = false
            }
        },
        [regionIntent, onKycSuccess, t, actionErrorMessage]
    )

    // called when sdk signals applicant submitted
    const handleSdkComplete = useCallback(() => {
        userInitiatedRef.current = true
        selfHealProviderRef.current = null
        actionKeyRef.current = null
        // Consume a deferred ACTION_REQUIRED (see the transition effect): this
        // close IS a submission, so the held transition is stale — replaying it
        // would close the progress modal this handler opens (in-session resubmit
        // after a RED decline). The manual close keeps the replay: abandoning
        // really does leave the action required.
        if (liveKycStatus === 'ACTION_REQUIRED') prevStatusRef.current = 'ACTION_REQUIRED'
        setShowWrapper(false)
        setIsActionFlow(false)
        setIsMultiLevel(false)
        setIsVerificationProgressModalOpen(true)
    }, [liveKycStatus])

    // called when user manually closes the sdk modal
    const handleClose = useCallback(() => {
        setShowWrapper(false)
        setIsActionFlow(false)
        setIsMultiLevel(false)
        onManualClose?.()
    }, [onManualClose])

    // token refresh function passed to the sdk for when the token expires.
    // routes by how the flow started: start-action key, self-heal provider, or
    // the regular KYC endpoint.
    const refreshToken = useCallback(async (): Promise<string> => {
        if (actionKeyRef.current) {
            const response = await startKycAction(actionKeyRef.current)
            if (response.error || !response.data?.token) {
                throw new Error(response.error || 'Failed to refresh action token')
            }
            setAccessToken(response.data.token)
            return response.data.token
        }

        if (selfHealProviderRef.current) {
            const response = await initiateSelfHealResubmission(selfHealProviderRef.current)
            if (response.error || !response.data?.token) {
                throw new Error(response.error || 'Failed to refresh self-heal token')
            }
            setAccessToken(response.data.token)
            return response.data.token
        }

        const response = await initiateSumsubKyc({
            regionIntent: regionIntentRef.current,
            levelName: levelNameRef.current,
            targetCountry: targetCountryRef.current,
        })

        if (response.error || !response.data?.token) {
            throw new Error(response.error || 'Failed to refresh token')
        }

        setAccessToken(response.data.token)
        return response.data.token
    }, [])

    const closeVerificationProgressModal = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
    }, [])

    const closeVerificationModalAndGoHome = useCallback(() => {
        setIsVerificationProgressModalOpen(false)
        router.push('/home')
    }, [router])

    const resetError = useCallback(() => {
        setIsTerminalError(false)
        setError(null)
    }, [])

    // Reset Sumsub IDENTITY step + open the WebSDK with a fresh token. The
    // user lands back on the document-upload screen so they can verify with a
    // different ID. Used as the CTA for the `restart-identity` gate state
    // (Manteca country-ineligibility — uploaded a non-AR/BR document).
    const handleRestartIdentity = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        setIsTerminalError(false)
        userInitiatedRef.current = true
        // Clear any prior self-heal context so refreshToken (below) doesn't
        // mistakenly hit the self-heal endpoint after a restart-identity flow
        // (CodeRabbit caught: stale selfHealProviderRef would route the next
        // refresh through initiateSelfHealResubmission instead of the regular path).
        selfHealProviderRef.current = null
        actionKeyRef.current = null

        try {
            const response = await restartIdentityVerification()
            if (response.error) {
                userInitiatedRef.current = false
                setError(actionErrorMessage(response))
                return
            }
            if (response.data?.token) {
                setAccessToken(response.data.token)
                // The restart reopens the SAME workflow the original initiate ran
                // (the token targets the applicant's existing level), so re-derive
                // the multi-level flag. Left false, a restarted LATAM `general`
                // session would close on first submit — before the
                // manteca-requirements questionnaire. Best-effort: the ref is
                // undefined when this hook instance never initiated, which keeps
                // today's single-level behavior.
                setIsMultiLevel(isMultiLevelIntent(regionIntentRef.current))
                setShowWrapper(true)
            } else {
                userInitiatedRef.current = false
                setError(t('errorRestartFailed'))
            }
        } catch (e: unknown) {
            userInitiatedRef.current = false
            const message = e instanceof Error ? e.message : t('unexpectedError')
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [t, actionErrorMessage])

    // initiate self-heal document resubmission: calls the resubmit API
    // and opens the sumsub SDK with the action token. `requirementKey` targets a
    // specific (e.g. future-dated advisory) Bridge requirement; omitted for the
    // legacy blocking flow.
    const handleSelfHealResubmit = useCallback(
        async (provider: 'BRIDGE' | 'MANTECA', requirementKey?: string) => {
            setIsLoading(true)
            setError(null)
            userInitiatedRef.current = true
            selfHealProviderRef.current = provider
            actionKeyRef.current = null

            try {
                const response = await initiateSelfHealResubmission(provider, requirementKey)

                if (response.error) {
                    userInitiatedRef.current = false
                    selfHealProviderRef.current = null
                    actionKeyRef.current = null
                    setError(actionErrorMessage(response))
                    return
                }

                if (response.data?.token) {
                    setAccessToken(response.data.token)
                    setShowWrapper(true)
                } else {
                    userInitiatedRef.current = false
                    selfHealProviderRef.current = null
                    actionKeyRef.current = null
                    setError(t('errorResubmitFailed'))
                }
            } catch (e: unknown) {
                userInitiatedRef.current = false
                selfHealProviderRef.current = null
                actionKeyRef.current = null
                const message = e instanceof Error ? e.message : t('unexpectedError')
                setError(message)
            } finally {
                setIsLoading(false)
            }
        },
        [t, actionErrorMessage]
    )

    // Start a capability nextAction by key (POST /users/kyc/start-action) and
    // open the WebSDK with the returned token. Unlike handleInitiateKyc (which
    // resolves the level from region and no-ops for an already-approved user),
    // this mints a token for the specific RFI level the key maps to — the path
    // the advisory pre-empt needs to start a future-dated requirement early.
    const handleStartAction = useCallback(
        async (key: string) => {
            setIsLoading(true)
            setError(null)
            userInitiatedRef.current = true
            selfHealProviderRef.current = null
            actionKeyRef.current = null

            try {
                const response = await startKycAction(key)
                if (response.error || !response.data?.token) {
                    userInitiatedRef.current = false
                    setError(response.error ? actionErrorMessage(response) : t('errorStartActionFailed'))
                    return
                }
                levelNameRef.current = response.data.levelName
                actionKeyRef.current = key
                setAccessToken(response.data.token)
                setIsActionFlow(true)
                setShowWrapper(true)
            } catch (e: unknown) {
                userInitiatedRef.current = false
                const message = e instanceof Error ? e.message : t('unexpectedError')
                setError(message)
            } finally {
                setIsLoading(false)
            }
        },
        [t, actionErrorMessage]
    )

    // Launch the fix for a `fixable` provider rejection. Manteca RFIs (PEP/FEP,
    // source of funds) are their own Sumsub levels, keyed by the verdict's
    // `sumsub:*` action — the legacy resubmit route only mints the generic
    // ID-reupload action, which Sumsub opens on its "already verified" screen and
    // the user loops back to the same modal. Bridge stays on resubmit: that route
    // resolves the level itself and stamps the externalActionId its webhook keys on.
    const handleFixableRejection = useCallback(
        (rejection: { provider: 'BRIDGE' | 'MANTECA'; actionKey?: string | null }) =>
            rejection.provider === 'MANTECA' && rejection.actionKey
                ? handleStartAction(rejection.actionKey)
                : handleSelfHealResubmit(rejection.provider),
        [handleStartAction, handleSelfHealResubmit]
    )

    return {
        isLoading,
        error,
        isTerminalError,
        showWrapper,
        accessToken,
        liveKycStatus,
        rejectLabels,
        handleInitiateKyc,
        handleRestartIdentity,
        handleSelfHealResubmit,
        handleStartAction,
        handleFixableRejection,
        handleSdkComplete,
        handleClose,
        refreshToken,
        isVerificationProgressModalOpen,
        closeVerificationProgressModal,
        closeVerificationModalAndGoHome,
        resetError,
        isActionFlow,
        isMultiLevel,
    }
}
