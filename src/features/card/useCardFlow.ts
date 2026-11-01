'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { USER } from '@/constants/query.consts'
import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { computeCardState, type CardTopLevelState } from '@/components/Card/cardState.utils'
import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'
import { initiateSelfHealResubmission, startKycAction } from '@/app/actions/sumsub'
import { rainApi, type ApplyForCardResponse, type RainFundingAccess } from '@/services/rain'
import { cardConsentDocuments } from '@/services/consent'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { fundingAccessQueryKey, useCardFundingAccess } from '@/hooks/useCardFundingAccess'
import { fundingSetupPath, sameIdentity, type RainFundingConsent } from '@/utils/rain-funding.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { refusalOf } from '@/features/kyc-features/report'
import { useHostedVerification } from '@/hooks/useHostedVerification'
import { useModalsContext } from '@/context/ModalsContext'
import { offerPushPrompt } from '@/hooks/useNotifications'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useZeroDev } from '@/hooks/useZeroDev'
import { writeStoredValue } from '@/utils/safe-storage'
import { isRainBalanceKnown } from '@/utils/balance.utils'
import { useSumsubReloadResume } from '@/hooks/useSumsubReloadResume'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { useKycFeatureActivation } from '@/features/paperwork-verification/useKycFeatureActivation'
import { ApiError } from '@/services/api-error'
/**
 * flow hook for the card page — owns every behaviour so the page stays dumb
 * (same model as features/home/useHomeFlow).
 */
export function useCardFlow() {
    const t = useTranslations('card')
    const queryClient = useQueryClient()
    const { user, fetchUser } = useAuth()
    const userId = user?.user?.userId
    const activation = useKycFeatureActivation('card', { automatic: false })
    const { balance, hasSufficientSpendableBalance } = useWallet()
    const isCardFunded = hasSufficientSpendableBalance(10)
    const [fundingRequired, setFundingRequired] = useState(false)
    useEffect(() => {
        if (isCardFunded) setFundingRequired(false)
    }, [isCardFunded])

    const {
        data: cardInfo,
        isLoading: cardInfoLoading,
        error: cardInfoError,
        refetch: refetchCardInfo,
    } = useQuery<CardInfoResponse>({
        queryKey: ['card-info', userId],
        queryFn: () => cardApi.getInfo(),
        enabled: !!userId,
        staleTime: 30_000,
    })

    const { overview, isLoading: overviewLoading, error: overviewError } = useRainCardOverview()
    // `isCardFunded` sums the smart account and Rain collateral. Both must be read
    // values: a failed first read or an unavailable Rain balance counts as 0 there.
    const isBalanceKnown = balance !== undefined && isRainBalanceKnown(overview)
    const needsFundingBeforeApply =
        !overview?.status.hasApplication && overview?.status.railStatus !== 'ENABLED' && !isCardFunded
    // Grant-only here: the Home prompt owns the funding state read.
    const { grant: grantFunding } = useRainFunding({ enabled: false })
    // The existing card permission, for a re-issue on the existing card path.
    const { serializeGrant } = useGrantSessionKey()
    // Which terms the card screen shows: the server's funding decision.
    const fundingAccess = useCardFundingAccess()
    // Latest user and connected wallet, read at the start of a callback and
    // after every await: a switch sends and signs nothing further.
    const { address: connectedAddress } = useZeroDev()
    const identityRef = useRef({ userId, connectedAddress })
    identityRef.current = { userId, connectedAddress }
    const { capabilities, railsForProvider, nextActionsForRail, isLoading: capabilitiesLoading } = useCapabilities()
    const cardRail = railsForProvider('rain')[0]
    const reasonCode = cardRail?.reason?.code ?? null
    const applicationStatus = overview?.status.applicationStatus ?? null
    const railStatus = overview?.status.railStatus ?? null
    const hasOverviewStatus = !!overview?.status
    const showsCapabilityReason =
        !!overview?.status.hasApplication && railStatus !== 'PENDING' && railStatus !== 'ENABLED'
    const userFetching = useIsFetching({ queryKey: [USER] })
    const lastOverviewStatusRef = useRef<{
        userId: string
        railStatus: string | null
        applicationStatus: string | null
    } | null>(null)
    useEffect(() => {
        if (!userId) {
            lastOverviewStatusRef.current = null
            return
        }
        if (!hasOverviewStatus) return
        const previous = lastOverviewStatusRef.current
        lastOverviewStatusRef.current = { userId, railStatus, applicationStatus }
        const firstSight = previous?.userId !== userId
        const changed =
            !!previous &&
            !firstSight &&
            (previous.railStatus !== railStatus || previous.applicationStatus !== applicationStatus)
        // The cached profile can predate the first overview, so a screen that shows the capability reason refreshes it once.
        if (changed || (firstSight && showsCapabilityReason)) {
            void queryClient.invalidateQueries({ queryKey: [USER] })
        }
    }, [userId, hasOverviewStatus, railStatus, applicationStatus, showsCapabilityReason, queryClient])
    const { setIsSupportModalOpen } = useModalsContext()
    const onBack = useSafeBack('/home')
    const router = useRouter()

    // Sumsub card-application token — populated when POST /rain/cards reports
    // the user still needs to complete the rain-card-application level.
    const [sumsubToken, setSumsubToken] = useState<string | null>(null)
    const [applyError, setApplyError] = useState<string | null>(null)
    // When backend returns status:'terms-required', we capture it here so
    // the dispatcher can render the terms screen between Sumsub and submit.
    const [pendingTerms, setPendingTerms] = useState<{ isUsResident: boolean } | null>(null)
    // When backend returns status:'country-confirmation-required' (Sumsub
    // address country contradicts the ID-document country), we capture the
    // candidate list here so the dispatcher can render the residence
    // confirmation screen before terms.
    const [pendingCountryConfirmation, setPendingCountryConfirmation] = useState<{ candidates: string[] } | null>(null)
    // Covers the moment between "terms accepted" and "overview refetched with
    // the new card row". Without it the screen would briefly flip back to Add
    // Card mid-apply before the state machine sees the new state.
    const [isIssuing, setIsIssuing] = useState(false)
    // Set when POST /rain/cards answers `geo-blocked` (country on Rain's
    // prohibited-issuance list, detected from the Sumsub address at apply
    // time). Per-mount — the cardInfo refetch it triggers makes the state
    // machine's geoProhibited path own the block durably.
    const [geoBlocked, setGeoBlocked] = useState(false)
    // Unlike geoBlocked, this is not a terminal issuer denial: the approved
    // KYC residence is eligible and only an open residence-change request is
    // restricting issuance. The recovery screen links to that exact request.
    const [pendingResidenceBlocked, setPendingResidenceBlocked] = useState(false)
    // The plan's refusal of the card: the API's report (`capabilities.features.card`),
    // so it reads the same on every visit. The apply answer bridges the moment
    // before the re-read report carries it; Back dismisses it for this visit.
    const [appliedRefusal, setAppliedRefusal] = useState<string | null>(null)
    const [refusalDismissed, setRefusalDismissed] = useState(false)
    const cardRefusal = refusalOf(capabilities.features?.card)
    const reportedRefusal = cardRefusal && reasonCodeKey(cardRefusal) ? cardRefusal : null
    const planRefusal = refusalDismissed ? null : (reportedRefusal ?? appliedRefusal)
    const setPlanRefusal = useCallback((reason: string | null) => {
        setAppliedRefusal(reason)
        setRefusalDismissed(reason === null)
    }, [])
    // Smart Paperwork Verification: POST /rain/cards answered `questions-required` with the step to ask; the card questions come first.
    const [pendingQuestions, setPendingQuestions] = useState<string | null>(null)
    const [pendingApplication, setPendingApplication] = useState<'pending-identity' | 'pending' | null>(null)
    useEffect(() => {
        setPendingApplication(null)
    }, [userId])

    const state = computeCardState({
        overview,
        cardInfo,
        overviewLoading,
        cardInfoLoading: cardInfoLoading,
    })

    // Fire CARD_STATE_VIEWED on each distinct top-level state entry. Skip the
    // initial 'loading' state — it would inflate the funnel without signal.
    const lastReportedStateRef = useRef<CardTopLevelState | null>(null)
    useEffect(() => {
        if (state === 'loading') return
        if (lastReportedStateRef.current === state) return
        // Wait out a profile refresh so reason_code matches the overview status; reads the client, not the hook, to see a refetch started this commit.
        if (queryClient.isFetching({ queryKey: [USER] }) > 0) return
        posthog.capture(ANALYTICS_EVENTS.CARD_STATE_VIEWED, {
            state,
            previous_state: lastReportedStateRef.current,
            application_status: applicationStatus,
            reason_code: reasonCode,
        })
        lastReportedStateRef.current = state
    }, [state, applicationStatus, reasonCode, userFetching, queryClient])

    // Write-only URL mirror for the computed state. Lets you see at a glance
    // which screen the user is on (?card_state=add-card, etc.) without
    // making the URL the source of truth — manipulating the param has no
    // effect on the rendered screen, the server state still wins. Skips
    // 'loading' to avoid a noisy intermediate value on mount.
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (state === 'loading') return
        const url = new URL(window.location.href)
        if (url.searchParams.get('card_state') === state) return
        url.searchParams.set('card_state', state)
        window.history.replaceState(window.history.state, '', url.toString())
    }, [state])

    const invalidateOverview = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
    }, [queryClient])

    // The identity steps a plan refusal asks for: a supplement, or a restart with another document.
    const kycFlow = useMultiPhaseKycFlow({
        onKycSuccess: () => {
            setPlanRefusal(null)
            invalidateOverview()
        },
        // The card's own Sumsub resumes from `kyc`; replaying it here started a legacy identity check.
        resumeOnReload: false,
    })
    const startFlowAction = kycFlow.handleStartAction
    const restartIdentity = kycFlow.handleRestartIdentity

    // Proof-of-address self-heal — a dedicated, deliberately tiny flow. The
    // multi-phase KYC machinery (useMultiPhaseKycFlow) is bank-onboarding
    // shaped: its post-approval phase machine polls a mutating endpoint, can
    // fan out to Bridge ToS modals, and completes on rail semantics that never
    // match the Rain PoA lifecycle. Here we only need: mint an action token →
    // open the SDK → on submit, thank the user and refetch. Separate surface
    // from the card-application SumsubKycWrapper below — that one is driven by
    // applyForCard tokens with its own refresh/poll semantics.
    const [poaToken, setPoaToken] = useState<string | null>(null)
    const [poaError, setPoaError] = useState<string | null>(null)
    // Optimistic "we got your document" until the backend webhook flips the
    // rail reason to its own review-wait state (may lag the SDK by seconds).
    const [poaSubmitted, setPoaSubmitted] = useState(false)

    // The rain rail's self-serve proof-of-address action, when the backend
    // classified the application as PoA-fixable (kind 'sumsub' + levelKey
    // 'proof_of_address' — emitted for WRONG_ADDRESS-class denials). Absent →
    // the status screens keep their contact-support-only shape.
    const poaAction = cardRail
        ? nextActionsForRail(cardRail.id).find(
              (action) => action.kind === 'sumsub' && action.levelKey === 'proof_of_address'
          )
        : undefined
    // Double-click guard: two concurrent initiations race the backend's
    // create-action idempotency into minting two Sumsub actions (the id
    // collision path deliberately mints a suffixed fresh action).
    const poaStartingRef = useRef(false)
    const startProofOfAddressUpload = useCallback(async () => {
        if (poaStartingRef.current) return
        poaStartingRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED, { source: 'poa-self-heal' })
        setPoaError(null)
        try {
            const response = await initiateSelfHealResubmission('RAIN')
            // Rain's selfie and ID come first, and only through the identity restart.
            if (response.fallback === 'restart-identity') {
                void restartIdentity()
                return
            }
            if (response.error || !response.data?.token) {
                // Surfaced inline on the status screen — a silent primary CTA on
                // a stuck-application screen is worse than no CTA.
                setPoaError(response.error ?? 'Could not start the upload. Please try again.')
                return
            }
            setPoaToken(response.data.token)
        } finally {
            poaStartingRef.current = false
        }
    }, [restartIdentity])
    const onUploadProofOfAddress = poaAction && !poaSubmitted ? () => void startProofOfAddressUpload() : undefined

    // The rain rail's identity-document re-upload action, emitted when Rain
    // rejected the card application on a proof-of-identity document. Rather than
    // a Sumsub token we own, this hands off to Rain's card-member portal (which
    // runs and re-adjudicates its own Sumsub flow) via the shared hosted-
    // verification handoff — same gesture-bound tab reservation as bridge-hosted.
    const identityAction = cardRail
        ? nextActionsForRail(cardRail.id).find((action) => action.kind === 'rain-hosted')
        : undefined
    const { start: startIdentityUpload, error: identityUploadError } = useHostedVerification('rain-hosted')
    // needsVerification: Rain's selfie and ID come from a new identity check, which the API then sends to Rain.
    const identityRestartAction = cardRail
        ? nextActionsForRail(cardRail.id).find((action) => action.kind === 'restart-identity')
        : undefined
    const onUploadIdentity = identityAction
        ? () => void startIdentityUpload()
        : identityRestartAction
          ? () => void restartIdentity()
          : undefined

    const informationActions = cardRail
        ? nextActionsForRail(cardRail.id).filter(
              (action) =>
                  action.kind === 'sumsub' &&
                  action.purpose === 'rain-card' &&
                  (action.levelKey === 'tax_identification_number' || action.levelKey === 'birth_details')
          )
        : []
    const [informationSession, setInformationSession] = useState<{ key: string; token: string } | null>(null)
    const [informationError, setInformationError] = useState<string | null>(null)
    const informationStartingRef = useRef<object | null>(null)
    const informationUserRef = useRef(userId)
    informationUserRef.current = userId
    useEffect(() => {
        setInformationSession(null)
        setInformationError(null)
        return () => {
            informationStartingRef.current = null
        }
    }, [userId])
    const startInformationAction = useCallback(
        async (key: string) => {
            if (!userId || informationStartingRef.current || informationSession) return
            const attempt = {}
            informationStartingRef.current = attempt
            setInformationError(null)
            try {
                const response = await startKycAction(key)
                if (informationStartingRef.current !== attempt || informationUserRef.current !== userId) return
                if (response.fallback === 'restart-identity') {
                    void restartIdentity()
                    return
                }
                if (response.error || !response.data?.token) {
                    setInformationError(
                        response.code ? t('informationStartFailed') : (response.error ?? t('informationStartFailed'))
                    )
                    return
                }
                setInformationSession({ key, token: response.data.token })
            } catch {
                if (informationStartingRef.current === attempt && informationUserRef.current === userId) {
                    setInformationError(t('informationStartFailed'))
                }
            } finally {
                if (informationStartingRef.current === attempt) informationStartingRef.current = null
            }
        },
        [userId, informationSession, t, restartIdentity]
    )
    const refreshInformationToken = useCallback(async () => {
        if (!informationSession) throw new Error('No card information action to refresh')
        const response = await startKycAction(informationSession.key)
        if (!response.data?.token) throw new Error(response.error ?? 'Failed to refresh token')
        return response.data.token
    }, [informationSession])

    // Once the backend's own state takes over (the rail's sumsub action gives
    // way to the review-wait state, an approval, or a different ask), drop the
    // optimistic banner so a later re-offered upload isn't suppressed until
    // remount.
    useEffect(() => {
        if (poaSubmitted && !poaAction) setPoaSubmitted(false)
    }, [poaSubmitted, poaAction])

    // Routes a non-incomplete apply response to the right next screen. Shared
    // by the user-initiated apply path and the post-Sumsub poll, since both
    // need the same main-kyc-required / terms-required / default fan-out.
    // The `incomplete` branch is caller-specific (open Sumsub vs keep polling)
    // and stays inline.
    const advanceFromApplyResponse = useCallback(
        (res: ApplyForCardResponse) => {
            if (
                res.status === 'pending-identity' ||
                (res.status === 'pending' && !('rainUserId' in res && res.rainUserId))
            ) {
                setPendingTerms(null)
                setPendingCountryConfirmation(null)
                setPendingApplication(res.status)
                awaitingIssuanceRef.current = false
                invalidateOverview()
                return
            }
            setPendingApplication(null)
            // Main applicant is missing a doc Rain requires (e.g. SELFIE
            // after liveness was added to the level). Open WebSDK at the
            // MAIN level — Sumsub asks only for the missing step. Same
            // wrapper handles both action and main-level tokens.
            if (res.status === 'main-kyc-required' && 'sumsubAccessToken' in res) {
                setSumsubToken(res.sumsubAccessToken)
                posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                return
            }
            // Conflicting residence evidence — collect the user's pick before
            // anything reaches Rain. Cleared once a later response advances
            // past it (the answer is persisted server-side).
            if (res.status === 'country-confirmation-required' && 'candidates' in res) {
                setPendingTerms(null)
                setPendingCountryConfirmation({ candidates: res.candidates })
                return
            }
            if (res.status === 'terms-required' && 'isUsResident' in res) {
                setPendingCountryConfirmation(null)
                setPendingTerms({ isUsResident: res.isUsResident })
                return
            }
            // Terminal regulatory block from the BE gate. This can fire
            // mid-funnel for Sumsub-only users whose country is unknown until
            // their address lands (cardInfo.geoProhibited couldn't catch them
            // up front). Local flag renders the screen immediately — without
            // it the user would bounce back to add-card with a generic error
            // and an apply button that can never succeed. The cardInfo refetch
            // lets the state machine own the block on subsequent visits.
            if (res.status === 'geo-blocked') {
                setPendingTerms(null)
                setPendingCountryConfirmation(null)
                setPendingResidenceBlocked(false)
                setGeoBlocked(true)
                void refetchCardInfo()
                return
            }
            if (res.status === 'pending-residence-blocked') {
                setPendingTerms(null)
                setPendingCountryConfirmation(null)
                setGeoBlocked(false)
                setPendingResidenceBlocked(true)
                return
            }
            if (res.status === 'questions-required' && 'step' in res) {
                setPendingTerms(null)
                setPendingCountryConfirmation(null)
                setPendingQuestions(res.step)
                return
            }
            if (res.status === 'provider-not-in-plan' && 'message' in res) {
                setPendingTerms(null)
                setPendingCountryConfirmation(null)
                const reason = 'reason' in res ? res.reason : undefined
                if (reason === 'requirements_missing') void startFlowAction('supplement:rain')
                else if (reason && reasonCodeKey(reason)) {
                    setPlanRefusal(reason)
                    void fetchUser()
                } else setApplyError(res.message)
                return
            }
            // pending / already-applied → state machine routes based on overview.
            setPendingTerms(null)
            setPendingCountryConfirmation(null)
            // 'pending' promises a card. If the follow-up card-create fails
            // (e.g. Rain 400 on virtualCardArt during the inline auto-issue)
            // the backend still answers 'pending', the rail lands ENABLED with
            // no card, and the state machine routes back to add-card — which
            // read as a silent reset. Remember the promise so that landing
            // surfaces a retryable error instead (effect below).
            if (res.status === 'pending') awaitingIssuanceRef.current = true
            invalidateOverview()
        },
        [invalidateOverview, refetchCardInfo, startFlowAction, setPlanRefusal, fetchUser]
    )

    // Card-create-after-apply failure detector (see advanceFromApplyResponse).
    // Waits for the refetched overview to reflect the application, then: back
    // on the entry screen means the promised card never got created — show the
    // same retryable notification the entry screen uses for apply errors.
    // Stays armed through pending/manual-review: an asynchronous approval can
    // fail auto-issuance too, landing ENABLED-without-card later in the mount.
    // Disarms only once a card exists or a terminal state (incl. the surfaced
    // add-card error) is reached.
    const awaitingIssuanceRef = useRef(false)
    useEffect(() => {
        if (!awaitingIssuanceRef.current) return
        if (!overview?.status?.hasApplication) return
        if (state === 'loading' || state === 'pending' || state === 'manual-review') return
        awaitingIssuanceRef.current = false
        if (state === 'add-card') setApplyError(t('page.issueFailed'))
        if (state === 'active') void offerPushPrompt(PUSH_PROMPT_TRIGGERS.CARD_READY)
    }, [overview, state, t])

    // The user picked their residence country on the confirmation screen.
    // Re-apply with the pick — the backend validates it against its own
    // candidate recompute, repairs the Sumsub data, and usually answers
    // `terms-required` next.
    const handleConfirmCountry = useCallback(
        async (countryCode: string) => {
            // Bound to the account this callback was made for, like submitApplication.
            const startedFor = { userId, connectedAddress }
            const changed = () => !sameIdentity(identityRef.current, startedFor)
            if (changed()) return
            setApplyError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_COUNTRY_CONFIRMED, { country: countryCode })
            try {
                if (!(await activation.activate()) || changed()) return
                const res = await rainApi.applyForCard({ confirmedResidenceCountry: countryCode })
                if (changed()) return
                // Caller-specific `incomplete` branch (advanceFromApplyResponse
                // deliberately doesn't handle it): the applicant regressed
                // between the mismatch response and the confirm call — open the
                // WebSDK instead of silently dumping the user on the entry
                // screen via the default overview-invalidate arm.
                if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
                    setPendingCountryConfirmation(null)
                    setSumsubToken(res.sumsubAccessToken)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                    return
                }
                advanceFromApplyResponse(res)
            } catch (e) {
                if (changed()) return
                const message = e instanceof Error ? e.message : t('page.confirmCountryFailed')
                console.error('[card apply] country confirm error:', e)
                setApplyError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
            }
        },
        [advanceFromApplyResponse, userId, connectedAddress, t, activation.activate]
    )

    // Returns the response only when the application went through to a state
    // that can carry the funding permission; undefined on every other outcome.
    const submittingApplication = useRef<object | null>(null)
    const submitApplication = useCallback(
        async (termsAccepted = false, serializedApproval?: string) => {
            const attempt = {}
            const oneShot = user?.identityVerification?.oneShot === true
            if (oneShot && submittingApplication.current) return undefined
            if (oneShot) submittingApplication.current = attempt
            try {
                // Bound to the account this callback was made for: one captured
                // before a switch sends nothing, and a response that lands after
                // one changes nothing.
                const startedFor = { userId, connectedAddress }
                const changed = () => !sameIdentity(identityRef.current, startedFor)
                if (changed()) return undefined
                // A cached display balance cannot unlock a new application. Existing
                // applications and approved reissues retain their recovery paths.
                if (needsFundingBeforeApply) {
                    setFundingRequired(true)
                    setPendingTerms(null)
                    return undefined
                }
                setApplyError(null)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_ATTEMPTED, {
                    terms_accepted: termsAccepted,
                    with_session_key: !!serializedApproval,
                })
                try {
                    // Consent-ledger echo: on acceptance, send the exact documents
                    // CardTermsScreen displayed for this region (version + hash).
                    const acceptedDocuments = termsAccepted
                        ? cardConsentDocuments(pendingTerms?.isUsResident ?? false)
                        : undefined
                    if (!(await activation.activate()) || changed()) return undefined
                    const res = await rainApi.applyForCard({
                        termsAccepted,
                        acceptedDocuments,
                        ...(serializedApproval ? { serializedApproval } : {}),
                    })
                    if (changed()) return undefined
                    if (termsAccepted && res.status === 'pending' && userId) {
                        writeStoredValue(`card_issuance_celebration_pending_v1:${userId}`, '1')
                    }
                    posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
                    if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
                        setSumsubToken(res.sumsubAccessToken)
                        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                        return undefined
                    }
                    advanceFromApplyResponse(res)
                    return res
                } catch (e) {
                    if (changed()) return undefined
                    // A Smart Paperwork Verification user's identity check starts on /verify, never as a legacy applicant here.
                    if (e instanceof ApiError && e.code === 'paperwork_verification_required') {
                        router.push('/verify')
                        return undefined
                    }
                    const message = e instanceof Error ? e.message : t('page.applyFailed')
                    console.error('[card apply] error:', e)
                    setApplyError(message)
                    posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
                    return undefined
                }
            } finally {
                if (submittingApplication.current === attempt) submittingApplication.current = null
            }
        },
        [
            advanceFromApplyResponse,
            pendingTerms,
            needsFundingBeforeApply,
            userId,
            connectedAddress,
            t,
            router,
            activation.activate,
            user?.identityVerification?.oneShot,
        ]
    )

    const handleApply = useCallback(
        async (termsAccepted = false) => {
            await submitApplication(termsAccepted)
        },
        [submitApplication]
    )

    // `consent` is the funding authorization when the terms screen showed the
    // managed path, and null when it showed the existing card path.
    const handleAcceptTerms = useCallback(
        async (consent: RainFundingConsent | null) => {
            const canGrant = !!overview?.status?.contractAddress && !!overview?.status?.coordinatorAddress
            posthog.capture(ANALYTICS_EVENTS.CARD_TERMS_ACCEPTED, {
                is_reissue: canGrant,
                is_us_resident: pendingTerms?.isUsResident ?? false,
            })
            // The account this callback was made for. One captured before a
            // switch reads, sends and signs nothing for the next account.
            const startedFor = { userId, connectedAddress }
            const changed = () => !sameIdentity(identityRef.current, startedFor)
            if (changed()) return
            const shownPath = consent ? 'managed' : 'legacy'

            setIsIssuing(true)
            setApplyError(null)
            try {
                // The decision the screen was built on may be stale: read it
                // again before anything is signed or sent. Unknown stops here.
                let access: RainFundingAccess
                try {
                    access = await rainApi.getFundingAccess()
                } catch {
                    if (!changed()) setApplyError(t('page.setupFailed'))
                    return
                }
                if (changed()) return
                queryClient.setQueryData(fundingAccessQueryKey(startedFor), access)
                // The person accepted the text of one path. If the decision moved
                // to the other, nothing is applied or signed: the screen shows
                // the current path to accept again. A managed account never
                // goes back to the existing permission.
                const freshPath = fundingSetupPath(access)
                if (freshPath !== shownPath) {
                    setApplyError(t('funding.termsChanged'))
                    return
                }

                if (consent) {
                    const res = await submitApplication(true)
                    // This consent belongs to the account and wallet it was
                    // given for: after a switch it never starts the next
                    // account's enrollment.
                    if (changed()) return
                    // The permission needs a card account with a wallet on file,
                    // so it follows the application. Best effort: a first-time
                    // applicant has no wallet on file yet, and a cancelled or
                    // failed tap leaves the card as it is. The Home prompt asks
                    // again in either case until the backend reports it ready.
                    if (res && (res.status === 'pending' || res.status === 'ENABLED')) {
                        await grantFunding(consent, startedFor)
                    }
                    return
                }

                // The existing card path. First-time apply has no collateral
                // contracts yet: the card permission follows on Home after issuance.
                // The balance gate stops a new application before any signature.
                if (!canGrant || needsFundingBeforeApply) {
                    await submitApplication(true)
                    return
                }
                // Re-issue with contracts in place: the permission is signed in
                // the same flow, before the card is created. A cancelled or
                // failed signature creates no card.
                const tap = await serializeGrant(startedFor)
                if (changed()) return
                if (!tap.ok) {
                    setApplyError(
                        tap.error.kind === 'user-cancelled' ? t('page.setupCancelled') : t('page.setupFailed')
                    )
                    return
                }
                await submitApplication(true, tap.serialized)
            } finally {
                setIsIssuing(false)
            }
        },
        [
            submitApplication,
            overview,
            pendingTerms,
            grantFunding,
            serializeGrant,
            needsFundingBeforeApply,
            userId,
            connectedAddress,
            queryClient,
            t,
        ]
    )

    // Distinguishes "user finished the applicant action" from "user closed the
    // modal without finishing" — without this both paths would fire
    // CARD_SUMSUB_CLOSED and inflate the abandonment number.
    const sumsubCompletedRef = useRef(false)

    // Aborts the post-Sumsub poll on unmount so we don't burn 15 sequential
    // fetches (and setState on an unmounted component) when an impatient user
    // navigates away from the pending screen mid-poll.
    const pollAbortRef = useRef<AbortController | null>(null)
    const isMountedRef = useRef(true)
    useEffect(() => {
        // Re-armed on run, not just cleared on cleanup: StrictMode's dev
        // mount→cleanup→mount would otherwise leave the flag false for good.
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            pollAbortRef.current?.abort()
        }
    }, [])

    const handleSumsubComplete = useCallback(async () => {
        const startedFor = { userId, connectedAddress }
        const changed = () => !sameIdentity(identityRef.current, startedFor)
        if (changed()) return
        sumsubCompletedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_COMPLETED)
        setSumsubToken(null)
        setApplyError(null)
        setIsIssuing(true)

        pollAbortRef.current?.abort()
        const controller = new AbortController()
        pollAbortRef.current = controller

        try {
            if (!(await activation.activate()) || changed() || controller.signal.aborted) return
            // Two-stage poll. First wait for the webhook-stamped readiness flag
            // (cheap, DB-only, safe at 1s cadence). Once Sumsub has reviewed
            // rain-requirements GREEN, fall through to the existing apply poll.
            //
            // Previous behaviour: single-stage `pollUntilApplyAdvances` against
            // POST /rain/cards — every iteration hit Sumsub for `moveToLevel` +
            // `getApplicant` + `getQuestionnaireAnswers`. ~75 Sumsub round-trips
            // per stuck user, AND the WebSDK got re-opened on every `incomplete`
            // in the race window, showing the user "verification is taking
            // longer than expected" (Barbara F-M's 2026-06-02 Crisp escalation).
            const readyResult = await pollUntilReady({
                fetchReadiness: () => rainApi.getCardApplyReadiness(),
                intervalMs: 1000,
                timeoutMs: 30000,
                signal: controller.signal,
            })
            if (controller.signal.aborted) return
            if (readyResult === false) {
                setApplyError(t('page.verificationSlow'))
                return
            }

            // Sumsub is GREEN — single apply call should now advance past
            // `incomplete`. Keep `pollUntilApplyAdvances` as a thin safety net
            // for the rare case where the webhook flag landed but the
            // applicant state hasn't fully propagated (e.g. read-replica lag).
            const res = await pollUntilApplyAdvances({
                fetchApply: async () => {
                    if (changed()) throw new Error('Card account changed')
                    return rainApi.applyForCard({ termsAccepted: false })
                },
                intervalMs: 1000,
                timeoutMs: 5000,
                signal: controller.signal,
            })
            if (controller.signal.aborted || changed()) return
            if (!res) {
                setApplyError(t('page.verificationSlow'))
                return
            }
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
            advanceFromApplyResponse(res)
        } catch (e) {
            if (controller.signal.aborted || changed()) return
            const message = e instanceof Error ? e.message : t('page.applyFailed')
            console.error('[card apply] post-sumsub poll error:', e)
            setApplyError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
        } finally {
            // Release the issuance gate on EVERY exit, aborts included. Keying
            // this on `aborted` latched `isIssuing` true forever whenever the
            // poll was cancelled while the page stayed mounted — and nothing
            // else ever clears it, so the user was stranded on the pending
            // spinner (Android: the only way out was the hardware back). The
            // ownership check keeps a superseded run from clearing the gate its
            // successor now owns.
            if (isMountedRef.current && pollAbortRef.current === controller) setIsIssuing(false)
        }
    }, [advanceFromApplyResponse, t, activation.activate, userId, connectedAddress])

    const handleSumsubClose = useCallback(() => {
        if (!sumsubCompletedRef.current) {
            posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED)
        }
        sumsubCompletedRef.current = false
        setSumsubToken(null)
    }, [])

    const handleSumsubRefreshToken = useCallback(async () => {
        const startedFor = { userId, connectedAddress }
        if (!(await activation.activate()) || !sameIdentity(identityRef.current, startedFor)) return ''
        const res = await rainApi.applyForCard({ termsAccepted: false })
        if (!sameIdentity(identityRef.current, startedFor)) return ''
        if ((res.status === 'incomplete' || res.status === 'main-kyc-required') && 'sumsubAccessToken' in res) {
            return res.sumsubAccessToken
        }
        // Edge case: the user became "ready" between initial apply and the
        // refresh attempt. Close the modal and continue the non-Sumsub path.
        setSumsubToken(null)
        advanceFromApplyResponse(res)
        return ''
    }, [advanceFromApplyResponse, activation.activate, userId, connectedAddress])

    // Preserve an interrupted Sumsub session for installed Android PWAs that
    // remain reachable until the native migration cutoff.
    useSumsubReloadResume(sumsubToken !== null ? {} : null, async () => {
        const startedFor = { userId, connectedAddress }
        if (!(await activation.activate()) || !sameIdentity(identityRef.current, startedFor)) return false
        const res = await rainApi.applyForCard({ termsAccepted: false })
        if (!sameIdentity(identityRef.current, startedFor)) return false
        if ((res.status === 'incomplete' || res.status === 'main-kyc-required') && 'sumsubAccessToken' in res) {
            setSumsubToken(res.sumsubAccessToken)
            posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED, { resumed: true })
            return true
        }
        advanceFromApplyResponse(res)
        return false
    })

    // The card answers are saved and the card joined the saved features: apply again.
    const handleQuestionsDone = useCallback(() => {
        setPendingQuestions(null)
        void handleApply(false)
    }, [handleApply])

    return {
        activation,
        // data
        user,
        isCardFunded,
        isBalanceKnown,
        needsFundingBeforeApply,
        /** Which card terms to show: `managed` | `legacy`, undefined while unknown. */
        termsFundingPath: fundingAccess.setupPath,
        fundingAccessLoading: fundingAccess.isLoading,
        refetchFundingAccess: fundingAccess.refetch,
        fundingRequired,
        fetchUser,
        cardInfo,
        cardInfoError,
        refetchCardInfo,
        overview,
        overviewError,
        capabilitiesLoading,
        railsForProvider,
        // computed state
        state,
        // apply flow
        applyError,
        setApplyError,
        pendingTerms,
        setPendingTerms,
        pendingCountryConfirmation,
        setPendingCountryConfirmation,
        isIssuing,
        geoBlocked,
        pendingResidenceBlocked,
        planRefusal,
        setPlanRefusal,
        pendingQuestions,
        pendingApplication,
        setPendingQuestions,
        handleQuestionsDone,
        kycFlow,
        handleApply,
        handleConfirmCountry,
        handleAcceptTerms,
        invalidateOverview,
        // poa self-heal
        poaToken,
        setPoaToken,
        poaError,
        poaSubmitted,
        setPoaSubmitted,
        onUploadProofOfAddress,
        // identity: Rain's portal, or the identity restart for Rain's selfie and ID
        onUploadIdentity,
        identityUploadError: identityUploadError ?? (identityRestartAction ? kycFlow.error : null),
        informationActions,
        informationSession,
        setInformationSession,
        informationError,
        startInformationAction,
        refreshInformationToken,
        // card-application sumsub
        sumsubToken,
        handleSumsubComplete,
        handleSumsubClose,
        handleSumsubRefreshToken,
        // misc
        setIsSupportModalOpen,
        onBack,
    }
}
