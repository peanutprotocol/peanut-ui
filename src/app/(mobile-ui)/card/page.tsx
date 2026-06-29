'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { notFound } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'
import { useAuth } from '@/context/authContext'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { computeCardState, findActiveCard, type CardTopLevelState } from '@/components/Card/cardState.utils'
import { pollUntilApplyAdvances, pollUntilReady } from '@/components/Card/cardApply.utils'
import AddCardEntryScreen from '@/components/Card/AddCardEntryScreen'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import CardTermsScreen from '@/components/Card/CardTermsScreen'
import CardRejectionScreen from '@/components/Card/CardRejectionScreen'
import CardWaitlistJoinedScreen from '@/components/Card/CardWaitlistJoinedScreen'
import BadgeSkipCelebration from '@/components/Card/BadgeSkipCelebration'
import CardEligibilityCheckScreen from '@/components/Card/CardEligibilityCheckScreen'
import YourCardScreen from '@/components/Card/YourCardScreen'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { rainApi, type ApplyForCardResponse } from '@/services/rain'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useModalsContext } from '@/context/ModalsContext'
import { useSafeBack } from '@/hooks/useSafeBack'

// localStorage key for the one-time celebration gate (per-device by design:
// re-doing the funnel re-celebrates, see the eligibility-check effect below).
// v2 (2026-05-25): celebration now fires for ALL hasCardAccess users, not
// just skip-badge holders. v1's stale `true` values from earlier QA runs
// would silently skip the celebration — bumping the key invalidates them.
const SKIP_CELEBRATION_SEEN_KEY = 'card_skip_celebration_seen_v2'

function getSkipCelebrationSeen(): boolean {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SKIP_CELEBRATION_SEEN_KEY) === 'true'
}

function markSkipCelebrationSeen(): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SKIP_CELEBRATION_SEEN_KEY, 'true')
}

// Eligibility-check screen lifetime per Hugo's spec: gate fires every
// /card mount UNTIL the user has an issued card. Persisting across mount
// would skip the moment on revisit — wrong. Within a single mount, once
// the user releases the hold, the in-React state below stays true so
// they don't re-see the gate after celebration / add-card transitions.

const CardPage: FC = () => {
    const queryClient = useQueryClient()
    const { user, fetchUser } = useAuth()
    const userId = user?.user?.userId

    const {
        data: cardInfo,
        isLoading: pioneerLoading,
        error: pioneerError,
        refetch: refetchCardInfo,
    } = useQuery<CardInfoResponse>({
        queryKey: ['card-info', userId],
        queryFn: () => cardApi.getInfo(),
        enabled: !!userId,
        staleTime: 30_000,
    })

    const { overview, isLoading: overviewLoading, error: overviewError } = useRainCardOverview()
    const { serializeGrant } = useGrantSessionKey()
    const { railsForProvider, isLoading: capabilitiesLoading } = useCapabilities()
    const { setIsSupportModalOpen } = useModalsContext()
    const onBack = useSafeBack('/home')

    // Sumsub card-application token — populated when POST /rain/cards reports
    // the user still needs to complete the rain-card-application level.
    const [sumsubToken, setSumsubToken] = useState<string | null>(null)
    const [applyError, setApplyError] = useState<string | null>(null)
    // When backend returns status:'terms-required', we capture it here so
    // the dispatcher can render the terms screen between Sumsub and submit.
    const [pendingTerms, setPendingTerms] = useState<{ isUsResident: boolean } | null>(null)
    // Covers the moment between "terms accepted" and "overview refetched with
    // the new card row". Without it the screen would briefly flip back to Add
    // Card mid-apply before the state machine sees the new state.
    const [isIssuing, setIsIssuing] = useState(false)

    // Track whether the user has acknowledged the skip-badge celebration.
    // localStorage on purpose (per-device, replayable via the eligibility
    // re-hold below) — the celebration is a moment, not durable state.
    const [skipCelebrationSeen, setSkipCelebrationSeen] = useState<boolean>(() => getSkipCelebrationSeen())

    // Press-and-hold "see if you qualify" gate. Resets per mount: as long
    // as the user has not been issued a card, every fresh /card visit
    // re-shows the gate. Within the same mount, this stays true after they
    // release the hold so they don't get pulled back from celebration /
    // add-card. State machine ALSO skips the gate when an issued card
    // exists (see cardState.utils.ts — active-card wins first).
    const [eligibilityCheckDone, setEligibilityCheckDone] = useState<boolean>(false)

    // The old `?press_door=1` auto-stamp was removed alongside the /shhhhh
    // door rework: the bare door joins the waitlist and grants nothing, so a
    // shareable URL that silently stamps flowEarlyAccess would have been the
    // exact bypass the rework forbids. BE now also reports flowEarlyAccess
    // true whenever hasCardAccess is (inner gate implies outer).

    // Outer gate: pre-public-launch, the card campaign isn't fully online
    // yet. Users without flow early access get a 404 — the page behaves as
    // if it doesn't exist. The only ways in are (a) already holding a card
    // / being mid-application, or (b) holding card access (skip badge /
    // admin grant — BE reports flowEarlyAccess true whenever hasCardAccess
    // is). Everyone else belongs on /shhhhh, which joins the waitlist
    // inline and never routes here.
    //
    // IMPORTANT: skip the 404 if the user already has a non-canceled card.
    // Legacy Pioneers + admin-granted users issued cards before /shhhhh
    // existed and have no flowEarlyAccess stamp — they must still reach
    // YourCardScreen. The computeCardState() precedence below mirrors this
    // rule (active-card before no-flow-access).
    //
    // notFound() thrown synchronously inside the effect bubbles to Next's
    // not-found boundary just like a render-time call.
    useEffect(() => {
        if (pioneerLoading || pioneerError) return
        if (!cardInfo) return
        if (cardInfo.flowEarlyAccess) return
        // CR FE#1: wait for overview before checking issued cards — otherwise
        // legacy card-holders (overview still loading) get incorrectly 404'd
        // because `overview?.cards.some(...)` returns false on undefined input.
        if (overviewLoading || !overview) return
        const hasIssuedCard = overview.cards.some((c) => c.status !== 'CANCELED')
        if (hasIssuedCard) return
        posthog.capture(ANALYTICS_EVENTS.CARD_FLOW_GATED)
        notFound()
    }, [pioneerLoading, pioneerError, cardInfo, overview, overviewLoading])

    const state = computeCardState({
        overview,
        cardInfo,
        overviewLoading,
        cardInfoLoading: pioneerLoading,
        skipCelebrationSeen,
        eligibilityCheckDone,
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
    // which screen the user is on (?card_state=eligibility-check, etc.) without
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

    // Re-doing the funnel = re-celebrating. Every time the user lands on
    // the eligibility-check screen (a fresh /card visit, no card yet
    // issued, hold not yet completed), clear any stale celebration-seen
    // flag so the post-hold transition reliably surfaces the celebration.
    // The flag is set again when the user dismisses celebration via
    // "Continue to your card", so it still suppresses a re-trigger on
    // refresh after dismissal — only a fresh hold re-celebrates.
    useEffect(() => {
        if (state !== 'eligibility-check') return
        if (!skipCelebrationSeen) return
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(SKIP_CELEBRATION_SEEN_KEY)
        }
        setSkipCelebrationSeen(false)
    }, [state, skipCelebrationSeen])

    // Refetch the user profile when entering the celebration so the share
    // asset reflects the user's CURRENT badge collection. Without this,
    // badges granted (e.g. via auto-award webhooks or admin cheats) after
    // the auth context's initial /get-user don't appear on the asset —
    // user.user.badges stays cached as the login-time snapshot. Fires
    // once per state entry (ref-guarded) so we don't spam the BE.
    const celebrationFetchedUserRef = useRef(false)
    useEffect(() => {
        if (state !== 'waitlist-skip-celebration') {
            celebrationFetchedUserRef.current = false
            return
        }
        if (celebrationFetchedUserRef.current) return
        celebrationFetchedUserRef.current = true
        void fetchUser()
    }, [state, fetchUser])

    const invalidateOverview = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
    }, [queryClient])

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
            if (res.status === 'terms-required' && 'isUsResident' in res) {
                setPendingTerms({ isUsResident: res.isUsResident })
                return
            }
            // pending / already-applied → state machine routes based on overview.
            setPendingTerms(null)
            invalidateOverview()
        },
        [invalidateOverview]
    )

    const handleApply = useCallback(
        async (termsAccepted = false, serializedApproval?: string) => {
            setApplyError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_ATTEMPTED, {
                terms_accepted: termsAccepted,
                with_session_key: !!serializedApproval,
            })
            try {
                const res = await rainApi.applyForCard({ termsAccepted, serializedApproval })
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
                if (res.status === 'incomplete' && 'sumsubAccessToken' in res) {
                    setSumsubToken(res.sumsubAccessToken)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
                    return
                }
                advanceFromApplyResponse(res)
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Failed to apply for card'
                console.error('[card apply] error:', e)
                setApplyError(message)
                posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
            }
        },
        [advanceFromApplyResponse]
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
                setApplyError(
                    tap.error.kind === 'user-cancelled'
                        ? 'Setup cancelled — please try again.'
                        : 'Could not complete setup — please try again.'
                )
                return
            }
            await handleApply(true, tap.serialized)
        } finally {
            setIsIssuing(false)
        }
    }, [handleApply, overview, pendingTerms, serializeGrant])

    // Distinguishes "user finished the applicant action" from "user closed the
    // modal without finishing" — without this both paths would fire
    // CARD_SUMSUB_CLOSED and inflate the abandonment number.
    const sumsubCompletedRef = useRef(false)

    // Aborts the post-Sumsub poll on unmount so we don't burn 15 sequential
    // fetches (and setState on an unmounted component) when an impatient user
    // navigates away from the pending screen mid-poll.
    const pollAbortRef = useRef<AbortController | null>(null)
    useEffect(() => () => pollAbortRef.current?.abort(), [])

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
                setApplyError('Verification is taking longer than expected. Please try again.')
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
                setApplyError('Verification is taking longer than expected. Please try again.')
                return
            }
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_SUCCEEDED, { outcome: res.status })
            advanceFromApplyResponse(res)
        } catch (e) {
            if (controller.signal.aborted) return
            const message = e instanceof Error ? e.message : 'Failed to apply for card'
            console.error('[card apply] post-sumsub poll error:', e)
            setApplyError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: message })
        } finally {
            if (!controller.signal.aborted) setIsIssuing(false)
        }
    }, [advanceFromApplyResponse])

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
        } else {
            invalidateOverview()
        }
        return ''
    }, [invalidateOverview])

    // Outer-gate fail — the useEffect above fires notFound() to render the
    // 404 boundary; render nothing here so the page doesn't flash for the
    // one frame before that lands.
    if (state === 'no-flow-access') {
        return null
    }

    if (state === 'loading') {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (pioneerError || overviewError) {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full flex-col items-center justify-center gap-4 p-4">
                    <p className="text-center text-n-1">Failed to load card info. Please try again.</p>
                    <Button onClick={() => refetchCardInfo()} variant="purple" shadowSize="4">
                        Retry
                    </Button>
                </div>
            </PageContainer>
        )
    }

    const renderState = () => {
        // Highest priority: show the issuance spinner between "terms accepted"
        // and the overview refetch landing. Keeps the UX from flipping back
        // to Add Card for a split second while the API call is in flight.
        if (isIssuing) {
            return <ApplicationStatusScreen variant="pending" />
        }
        // Terms screen takes precedence over the state-machine target — the
        // user already clicked "Get your card" or completed Sumsub; we need
        // to collect consent before letting them back out to Add Card.
        if (pendingTerms) {
            return (
                <CardTermsScreen
                    isUsResident={pendingTerms.isUsResident}
                    onAccept={handleAcceptTerms}
                    onPrev={() => setPendingTerms(null)}
                    submitError={applyError}
                />
            )
        }
        switch (state) {
            case 'eligibility-check':
                return (
                    <CardEligibilityCheckScreen
                        username={user?.user?.username ?? undefined}
                        onPrev={onBack}
                        onComplete={() => {
                            setEligibilityCheckDone(true)
                            // The state machine re-evaluates on the next render
                            // and either lands on 'waitlist-skip-celebration' or
                            // 'waitlist' based on skipBadges. No nav, just a
                            // state flip — keeps the share-asset reveal feeling
                            // continuous.
                        }}
                    />
                )
            case 'waitlist': {
                // Joined vs not-joined are two distinct screens — keeps each
                // tight to its own purpose. Not-joined is the Berghain-style
                // "not tonight" rejection: a shareable door let-down (tags
                // @joinpeanut) that doubles as the waitlist-join CTA. Once
                // they join, the state machine flips to the friendly
                // <CardWaitlistJoinedScreen /> cooldown.
                if (cardInfo!.waitlistJoinedAt) {
                    return <CardWaitlistJoinedScreen onPrev={onBack} />
                }
                return (
                    <CardRejectionScreen
                        username={user?.user?.username ?? undefined}
                        onPrev={onBack}
                        onJoined={refetchCardInfo}
                    />
                )
            }
            case 'waitlist-skip-celebration': {
                // Pick the freshest skip badge for the celebration headline.
                const skipCode = cardInfo!.skipBadges[0]
                // Share asset shows ALL earned badges, not just skip-badges.
                // `user.user.badges` is the full collection from /get-user
                // (with earnedAt) — fall back to cardInfo.skipBadges if it
                // hasn't loaded yet so we still render something.
                const allBadges =
                    user?.user?.badges?.map((b) => ({
                        code: b.code,
                        earnedAt: b.earnedAt,
                    })) ?? cardInfo!.skipBadges.map((code) => ({ code }))
                return (
                    <BadgeSkipCelebration
                        badgeCode={skipCode}
                        username={user?.user?.username ?? undefined}
                        badges={allBadges}
                        onContinue={() => {
                            markSkipCelebrationSeen()
                            setSkipCelebrationSeen(true)
                            invalidateOverview()
                            void refetchCardInfo()
                        }}
                    />
                )
            }
            case 'add-card':
                return <AddCardEntryScreen onApply={() => handleApply(false)} onPrev={onBack} applyError={applyError} />
            case 'pending':
                return <ApplicationStatusScreen variant="pending" onPrev={onBack} />
            case 'manual-review':
                return <ApplicationStatusScreen variant="manual-review" onPrev={onBack} />
            case 'requires-info': {
                // Surface the structured remediation reason from the
                // capabilities read-model — `rail.reason.userMessage` is
                // display-ready and provider-neutral by contract. The card
                // provider serves exactly one rail, so [0] is the card rail.
                // Overview and capabilities load independently — wait for
                // capabilities so the screen never flashes without its reason.
                if (capabilitiesLoading) {
                    return (
                        <div className="flex min-h-[inherit] w-full items-center justify-center">
                            <Loading />
                        </div>
                    )
                }
                const cardRailReason = railsForProvider('rain')[0]?.reason?.userMessage
                return (
                    <ApplicationStatusScreen
                        variant="requires-info"
                        reasonMessage={cardRailReason}
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            }
            case 'requires-support':
                // Pipeline-side failure — nothing the user can re-submit.
                // Same support deep-link as 'rejected' below.
                return (
                    <ApplicationStatusScreen
                        variant="requires-support"
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'rejected':
                // No retry CTA: Rain denials are terminal on our side. The
                // only path forward is support reviewing the case manually
                // (PEP / sanctions / fraud-pattern flags need a human in the
                // loop on Rain's end). Open Crisp directly — sending the user
                // to /support's FAQ first adds a step for no upside.
                return (
                    <ApplicationStatusScreen
                        variant="rejected"
                        onContactSupport={() => setIsSupportModalOpen(true)}
                        onPrev={onBack}
                    />
                )
            case 'active': {
                const card = findActiveCard(overview)!
                return <YourCardScreen overview={overview!} card={card} onPrev={onBack} />
            }
            default:
                return null
        }
    }

    return (
        <PageContainer>
            {renderState()}
            <SumsubKycWrapper
                visible={sumsubToken !== null}
                accessToken={sumsubToken}
                onClose={handleSumsubClose}
                onComplete={handleSumsubComplete}
                onRefreshToken={handleSumsubRefreshToken}
            />
        </PageContainer>
    )
}

export default CardPage
