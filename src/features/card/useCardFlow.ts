'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { computeCardState, type CardTopLevelState } from '@/components/Card/cardState.utils'
import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'
import { initiateSelfHealResubmission } from '@/app/actions/sumsub'
import { rainApi, type ApplyForCardResponse } from '@/services/rain'
import { cardConsentDocuments } from '@/services/consent'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useHostedVerification } from '@/hooks/useHostedVerification'
import { useModalsContext } from '@/context/ModalsContext'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSumsubReloadResume } from '@/hooks/useSumsubReloadResume'
/**
 * flow hook for the card page — owns every behaviour so the page stays dumb
 * (same model as features/home/useHomeFlow).
 */
export function useCardFlow() {
    const t = useTranslations('card')
    const queryClient = useQueryClient()
    const { user, fetchUser } = useAuth()
    const userId = user?.user?.userId

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
    const { serializeGrant } = useGrantSessionKey()
    const { railsForProvider, nextActionsForRail, isLoading: capabilitiesLoading } = useCapabilities()
    const { setIsSupportModalOpen } = useModalsContext()
    const onBack = useSafeBack('/home')

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
        posthog.capture(ANALYTICS_EVENTS.CARD_STATE_VIEWED, {
            state,
            previous_state: lastReportedStateRef.current,
        })
        lastReportedStateRef.current = state
    }, [state])

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
    const cardRail = railsForProvider('rain')[0]
    const poaAction = cardRail
        ? nextActionsForRail(cardRail.id).find(
              (action) => action.kind === 'sumsub' && action.levelKey === 'proof_of_address'
          )
        : undefined
    // Double-click guard: two concurrent initiations race the backend's
    // create-action idempotency into minting two Sumsub actions (the id
    // collision path deliberately mints a suffixed fresh action).
    const poaStartingRef = useRef(false)
    const startPoaUpload = useCallback(async () => {
        if (poaStartingRef.current) return
        poaStartingRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED, { source: 'poa-self-heal' })
        setPoaError(null)
        try {
            const response = await initiateSelfHealResubmission('RAIN')
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
    }, [])
    const onUploadProofOfAddress = poaAction && !poaSubmitted ? () => void startPoaUpload() : undefined

    // The rain rail's identity-document re-upload action, emitted when Rain
    // rejected the card application on a proof-of-identity document. Rather than
    // a Sumsub token we own, this hands off to Rain's card-member portal (which
    // runs and re-adjudicates its own Sumsub flow) via the shared hosted-
    // verification handoff — same gesture-bound tab reservation as bridge-hosted.
    const identityAction = cardRail
        ? nextActionsForRail(cardRail.id).find((action) => action.kind === 'rain-hosted')
        : undefined
    const { start: startIdentityUpload, error: identityUploadError } = useHostedVerification('rain-hosted')
    const onUploadIdentity = identityAction ? () => void startIdentityUpload() : undefined

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
                setGeoBlocked(true)
                void refetchCardInfo()
                return
            }
            // pending / already-applied → state machine routes based on overview.
            setPendingTerms(null)
            setPendingCountryConfirmation(null)
            invalidateOverview()
        },
        [invalidateOverview, refetchCardInfo]
    )

    // The user picked their residence country on the confirmation screen.
    // Re-apply with the pick — the backend validates it against its own
    // candidate recompute, repairs the Sumsub data, and usually answers
    // `terms-required` next.
    const handleConfirmCountry = useCallback(
        async (countryCode: string) => {
            setApplyError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_COUNTRY_CONFIRMED, { country: countryCode })
            try {
                const res = await rainApi.applyForCard({ confirmedResidenceCountry: countryCode })
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
                const message = e instanceof Error ? e.message : t('page.confirmCountryFailed')
                console.error('[card apply] country confirm error:', e)
                setApplyError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
            }
        },
        [advanceFromApplyResponse, t]
    )

    const handleApply = useCallback(
        async (termsAccepted = false, serializedApproval?: string) => {
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
                const res = await rainApi.applyForCard({ termsAccepted, serializedApproval, acceptedDocuments })
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
                if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
                    setSumsubToken(res.sumsubAccessToken)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                    return
                }
                advanceFromApplyResponse(res)
            } catch (e) {
                const message = e instanceof Error ? e.message : t('page.applyFailed')
                console.error('[card apply] error:', e)
                setApplyError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
            }
        },
        [advanceFromApplyResponse, pendingTerms, t]
    )

    const handleAcceptTerms = useCallback(async () => {
        // If we already have the collateral contract (rail is ENABLED, re-issue
        // path), collect the session-key permission in the same passkey tap
        // before the backend creates the card. Fail closed: a cancelled /
        // failed tap means no card gets issued.
        const canGrant = !!overview?.status?.contractAddress && !!overview?.status?.coordinatorAddress
        posthog.capture(ANALYTICS_EVENTS.CARD_TERMS_ACCEPTED, {
            is_reissue: canGrant,
            is_us_resident: pendingTerms?.isUsResident ?? false,
        })

        if (!canGrant) {
            // First-time apply — no collateral proxy yet. Session-key grant
            // happens the next time the user lands here (re-issue path).
            setIsIssuing(true)
            try {
                await handleApply(true)
            } finally {
                setIsIssuing(false)
            }
            return
        }

        const isUsResidentSnapshot = pendingTerms?.isUsResident ?? false
        setIsIssuing(true)
        setApplyError(null)
        try {
            const tap = await serializeGrant()
            if (!tap.ok) {
                // Back to the terms screen with a friendly error. Don't hit
                // the backend — no card should be created without consent.
                setIsIssuing(false)
                setPendingTerms({ isUsResident: isUsResidentSnapshot })
                setApplyError(tap.error.kind === 'user-cancelled' ? t('page.setupCancelled') : t('page.setupFailed'))
                return
            }
            await handleApply(true, tap.serialized)
        } finally {
            setIsIssuing(false)
        }
    }, [handleApply, overview, pendingTerms, serializeGrant, t])

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
        sumsubCompletedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_COMPLETED)
        setSumsubToken(null)
        setApplyError(null)
        setIsIssuing(true)

        pollAbortRef.current?.abort()
        const controller = new AbortController()
        pollAbortRef.current = controller

        try {
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
                fetchApply: () => rainApi.applyForCard({ termsAccepted: false }),
                intervalMs: 1000,
                timeoutMs: 5000,
                signal: controller.signal,
            })
            if (controller.signal.aborted) return
            if (!res) {
                setApplyError(t('page.verificationSlow'))
                return
            }
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
            advanceFromApplyResponse(res)
        } catch (e) {
            if (controller.signal.aborted) return
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
    }, [advanceFromApplyResponse, t])

    const handleSumsubClose = useCallback(() => {
        if (!sumsubCompletedRef.current) {
            posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED)
        }
        sumsubCompletedRef.current = false
        setSumsubToken(null)
    }, [])

    const handleSumsubRefreshToken = useCallback(async () => {
        const res = await rainApi.applyForCard({ termsAccepted: false })
        if ((res.status === 'incomplete' || res.status === 'main-kyc-required') && 'sumsubAccessToken' in res) {
            return res.sumsubAccessToken
        }
        // Edge case: the user became "ready" between initial apply and the
        // refresh attempt. Close the modal and continue the non-Sumsub path.
        setSumsubToken(null)
        if (res.status === 'terms-required' && 'isUsResident' in res) {
            setPendingTerms({ isUsResident: res.isUsResident })
        } else if (res.status === 'country-confirmation-required' && 'candidates' in res) {
            setPendingCountryConfirmation({ candidates: res.candidates })
        } else if (res.status === 'geo-blocked') {
            setGeoBlocked(true)
            void refetchCardInfo()
        } else {
            invalidateOverview()
        }
        return ''
    }, [invalidateOverview, refetchCardInfo])

    // PWA-reload resume (see useSumsubReloadResume). On a reload mid-Sumsub,
    // re-apply to mint a fresh token for the same in-progress applicant and
    // reopen the SDK — same idempotent call the token-refresh path uses. The
    // card flow takes no initiate arguments, so the persisted state is empty.
    useSumsubReloadResume(sumsubToken !== null ? {} : null, async () => {
        const res = await rainApi.applyForCard({ termsAccepted: false })
        if ((res.status === 'incomplete' || res.status === 'main-kyc-required') && 'sumsubAccessToken' in res) {
            setSumsubToken(res.sumsubAccessToken)
            // tagged so a resume doesn't read as a fresh open in the card funnel
            posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED, { resumed: true })
            return true
        }
        // user advanced past Sumsub while backgrounded — route normally
        advanceFromApplyResponse(res)
        return false
    })

    return {
        // data
        user,
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
        // identity re-upload
        onUploadIdentity,
        identityUploadError,
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
