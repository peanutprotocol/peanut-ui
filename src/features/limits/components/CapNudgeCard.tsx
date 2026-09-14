'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { startKycAction } from '@/app/actions/sumsub'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useLimits } from '@/hooks/useLimits'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { selectMantecaCapNudge } from '@/utils/capability-gate'

/**
 * How long a local submission suppresses the CTA on its own.
 *
 * The backend only flips the hint from `raise` to `wait` when the RFI webhook
 * lands, which is asynchronous and can be lost. Long enough to cover the
 * ordinary webhook, short enough that a lost one re-offers the upload instead
 * of hiding it forever — and short enough that it can never be the reason a
 * genuinely NEW cap block goes unanswered.
 */
const CAP_NUDGE_SUBMITTED_TTL_MS = 10 * 60 * 1000

/**
 * Re-arm cadence for the post-write poller, comfortably under the submission
 * window's 30s so it never lapses. Same device as {@link useWaitingOnProviderModal},
 * and for the same reason: one `markSubmitted()` buys 30 seconds, and this rail
 * is ENABLED so the poller has no other predicate to keep it alive. A GREEN
 * review webhook can land well after that, and when it does there is nothing
 * scheduled to go and fetch the `wait` state it produced.
 *
 * Bounded by the card being mounted — leave the page and the interval clears —
 * and by the backend answering, whichever comes first.
 */
const REARM_INTERVAL_MS = 20_000

/**
 * The Manteca cap-nudge — the surface for "you hit your monthly cap, verify your
 * income to raise it". Lives on the limits page, next to the (different)
 * {@link IncreaseLimitsButton} flow, so a capped user is never interrupted
 * mid-payment to be sold a limit raise.
 *
 * Two states, both non-blocking — the rail stays usable under the cap:
 *   - `raise`        — a fresh cap block: description + a CTA that mints a
 *                      source-of-funds token and opens the Sumsub SDK.
 *   - `under-review` — the document is already in. Sumsub accepting it does NOT
 *                      raise the Manteca cap (still a manual support step), so
 *                      this state neither re-asks for the document nor claims
 *                      the limit changed. It renders as copy with no control.
 *
 * Deliberately tiny, for the same reason the card's PoA self-heal is: the
 * multi-phase KYC machinery is bank-onboarding shaped and completes on rail
 * semantics this lifecycle never reaches. Here we need only mint → open →
 * arm the poller → let the backend take over.
 */
export default function CapNudgeCard() {
    const t = useTranslations('limits.capNudge')
    const tKyc = useTranslations('kyc')
    const { rails, nextActions } = useCapabilities()
    const { user, fetchUser } = useAuth()
    const { refetch: refetchLimits } = useLimits()

    const [token, setToken] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    // Two concurrent taps race the backend's create-action idempotency into
    // minting two Sumsub actions — the same guard the card PoA self-heal uses.
    const startingRef = useRef(false)

    const userId = user?.user?.userId
    const nudge = selectMantecaCapNudge(rails, nextActions)
    const actionKey = nudge?.state === 'raise' ? nudge.actionKey : null

    // Optimistic "we got it", persisted per user rather than held in component
    // state. The webhook that stamps `submittedAt` on the marker is a
    // round-trip away, and a flag that dies with this component let the user
    // navigate away, come back, and be offered the same upload again — which
    // is how a second Sumsub action gets minted for a document already in.
    // localStorage is unreadable during SSR, hence the post-render read.
    const [submittedAt, setSubmittedAt] = useState<number | null>(null)
    useEffect(() => {
        if (!userId) return
        const stored = getUserPreferences(userId)?.capNudgeSubmittedAt
        const parsed = stored ? Date.parse(stored) : NaN
        setSubmittedAt(Number.isNaN(parsed) ? null : parsed)
    }, [userId])

    // Recomputed only on render — and with a lost webhook the backend keeps
    // returning the same `raise` hint, so React Query's structural sharing hands
    // back an identical object and nothing re-renders. Without a timer at the
    // boundary the card stayed in the review state forever and the 20s re-arm
    // kept the 4s user poll alive indefinitely. Schedule the expiry so it
    // actually arrives.
    const [now, setNow] = useState(() => Date.now())
    const expiresAt = submittedAt === null ? null : submittedAt + CAP_NUDGE_SUBMITTED_TTL_MS
    useEffect(() => {
        if (expiresAt === null) return
        const remaining = expiresAt - Date.now()
        if (remaining <= 0) {
            setNow(Date.now())
            return
        }
        const id = setTimeout(() => setNow(Date.now()), remaining)
        return () => clearTimeout(id)
    }, [expiresAt])

    const recentlySubmitted = expiresAt !== null && now < expiresAt

    // Once the backend's own state takes over, drop the local flag: the marker
    // it wrote outlives this device, and leaving ours behind would suppress a
    // later, genuinely new cap block.
    useEffect(() => {
        if (!userId || submittedAt === null) return
        if (nudge?.state === 'raise' && recentlySubmitted) return
        updateUserPreferences(userId, { capNudgeSubmittedAt: undefined })
        setSubmittedAt(null)
    }, [userId, submittedAt, nudge?.state, recentlySubmitted])

    // Keep the poller alive for as long as we are still waiting on the webhook.
    // Stops the moment the backend's own state takes over (the hint flips to
    // `wait`), or the local marker ages out, or the user leaves the page.
    useEffect(() => {
        if (!recentlySubmitted || nudge?.state !== 'raise') return
        const id = setInterval(() => markSubmitted(), REARM_INTERVAL_MS)
        return () => clearInterval(id)
    }, [recentlySubmitted, nudge?.state])

    const start = useCallback(async () => {
        if (!actionKey || startingRef.current) return
        startingRef.current = true
        setIsStarting(true)
        setError(null)
        try {
            const response = await startKycAction(actionKey)
            if (response.error || !response.data?.token) {
                // Inline, not silent: a dead primary CTA on a limits screen reads
                // as "the raise isn't available to me".
                setError(response.error ?? tKyc('errorStartDocVerification'))
                return
            }
            setToken(response.data.token)
        } finally {
            startingRef.current = false
            setIsStarting(false)
        }
    }, [actionKey, tKyc])

    const refreshToken = useCallback(async (): Promise<string> => {
        if (!actionKey) throw new Error('No cap-nudge action to refresh')
        const response = await startKycAction(actionKey)
        if (!response.data?.token) throw new Error(response.error ?? 'Failed to refresh token')
        return response.data.token
    }, [actionKey])

    const onSubmit = useCallback(() => {
        setToken(null)
        // Arm the shared post-write poller BEFORE refetching. This rail is
        // ENABLED, so the auto-refresh predicate's pending-rail arm never fires
        // for it — without the window a single refetch races the webhook, and
        // losing that race leaves the actionable hint sitting in the user cache
        // for its full staleTime with nothing scheduled to correct it.
        markSubmitted()
        if (userId) updateUserPreferences(userId, { capNudgeSubmittedAt: new Date().toISOString() })
        setSubmittedAt(Date.now())
        void fetchUser()
        void refetchLimits()
    }, [userId, fetchUser, refetchLimits])

    const onClose = useCallback(() => {
        setToken(null)
        void fetchUser()
        void refetchLimits()
    }, [fetchUser, refetchLimits])

    if (!nudge) return null

    if (nudge.state === 'under-review' || recentlySubmitted) {
        return (
            <Card position="single" className="p-4">
                <p className="text-body-s text-foreground-secondary">{t('underReview')}</p>
            </Card>
        )
    }

    return (
        <>
            <Card position="single" className="space-y-3 p-4">
                <p className="text-body-s text-foreground-secondary">{t('description')}</p>
                <Button
                    className="w-full"
                    shadowSize="4"
                    onClick={() => void start()}
                    loading={isStarting}
                    disabled={isStarting}
                >
                    {t('cta')}
                </Button>
                {error && <p className="text-center text-body-xs text-foreground-error">{error}</p>}
            </Card>

            <SumsubKycWrapper
                visible={token !== null}
                accessToken={token}
                onClose={onClose}
                onComplete={onSubmit}
                onRefreshToken={refreshToken}
            />
        </>
    )
}
