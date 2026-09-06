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
import { selectMantecaCapNudge } from '@/utils/capability-gate'

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
 * semantics this lifecycle never reaches. Here we need only mint → open → refetch.
 */
export default function CapNudgeCard() {
    const t = useTranslations('limits.capNudge')
    const tKyc = useTranslations('kyc')
    const { rails, nextActions } = useCapabilities()
    const { fetchUser } = useAuth()
    const { refetch: refetchLimits } = useLimits()

    const [token, setToken] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    // Optimistic "we got it" between the SDK submit and the backend stamping
    // `submittedAt` on the marker (a webhook round-trip later). Without it the
    // actionable CTA lingers and invites a second upload of the same document.
    const [submitted, setSubmitted] = useState(false)
    // Two concurrent taps race the backend's create-action idempotency into
    // minting two Sumsub actions — the same guard the card PoA self-heal uses.
    const startingRef = useRef(false)

    const nudge = selectMantecaCapNudge(rails, nextActions)
    const actionKey = nudge?.state === 'raise' ? nudge.actionKey : null

    // Once the backend's own state takes over — the marker gains `submittedAt`
    // and the hint flips to `wait`, or a NEW cap block re-seeds the actionable
    // CTA — drop the optimistic flag so the re-offered upload isn't suppressed.
    useEffect(() => {
        if (submitted && nudge?.state !== 'raise') setSubmitted(false)
    }, [submitted, nudge?.state])

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

    const refresh = useCallback(() => {
        void fetchUser()
        void refetchLimits()
    }, [fetchUser, refetchLimits])

    if (!nudge) return null

    if (nudge.state === 'under-review' || submitted) {
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
                onClose={() => {
                    setToken(null)
                    refresh()
                }}
                onComplete={() => {
                    setToken(null)
                    setSubmitted(true)
                    refresh()
                }}
                onRefreshToken={refreshToken}
            />
        </>
    )
}
