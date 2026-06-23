'use client'

/**
 * <CardRejectionScreen /> — the Berghain-style "not tonight" rejection.
 *
 * Shown to a user who passed the eligibility hold but doesn't hold a card-
 * access badge. Instead of a flat "you don't have the badge" wall, they get
 * a shareable door rejection: a dark "not tonight, <username>" asset with a
 * smug peanut bouncer, the scarcity tally as screen copy, and a primary
 * "Tweet to appeal" CTA that shares the asset (random caption tagging
 * @joinpeanut). The friendly waitlist-joined screen is the cooldown AFTER
 * they share, so they don't rage-quit.
 */

import { type FC, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { ScaledRejectionAsset } from '@/components/Card/share-asset/ScaledRejectionAsset'
import { captureShareAsset, canShareImageFiles } from '@/components/Card/share-asset/captureShareAsset'
import { pickRejectionCaption } from '@/components/Card/share-asset/rejectionCaptions'
import type { RejectionMascot } from '@/components/Card/share-asset/shareAsset.types'
import { cardApi } from '@/services/card'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    username?: string
    /** Door tally — scarcity flex, rendered as screen copy (not on the asset). */
    applicants?: number
    admitted?: number
    /** Which smug mascot the asset shows. */
    mascot?: RejectionMascot
    onPrev?: () => void
    /** Called after the user joins the waitlist. Parent should refetch /card,
     *  which flips the state machine to <CardWaitlistJoinedScreen /> (cooldown). */
    onJoined?: () => void
}

const CardRejectionScreen: FC<Props> = ({
    username,
    applicants = 213,
    admitted = 7,
    mascot = 'cool',
    onPrev,
    onJoined,
}) => {
    const captureRef = useRef<HTMLDivElement | null>(null)
    const [sharing, setSharing] = useState(false)
    const [joining, setJoining] = useState(false)
    const [joinError, setJoinError] = useState<string | null>(null)
    const safeUsername = (username || '').trim() || 'anon'

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_VIEWED, { already_joined: false })
    }, [])

    const handleJoin = async (): Promise<void> => {
        setJoinError(null)
        setJoining(true)
        try {
            const res = await cardApi.joinWaitlist()
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOINED, { position: res.position })
            onJoined?.()
        } catch (e) {
            // Keep the user-facing message generic; raw BE text can leak
            // internals/PII. PostHog gets only the error CLASS for bucketing.
            console.error('[card-rejection] join failed', e)
            setJoinError('Failed to join waitlist. Please try again.')
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOIN_FAILED, {
                error_name: e instanceof Error ? e.name : 'unknown',
            })
        } finally {
            setJoining(false)
        }
    }

    const handleAppeal = async (): Promise<void> => {
        const caption = pickRejectionCaption()
        setSharing(true)
        try {
            if (!canShareImageFiles()) {
                posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                    source: 'rejection-appeal',
                    method: 'twitter-intent-fallback',
                })
                window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`,
                    '_blank',
                    'noopener'
                )
                return
            }
            const node = captureRef.current
            if (!node) throw new Error('rejection asset not yet rendered — try again in a moment')
            const blob = await captureShareAsset(node)
            const file = new File([blob], 'peanut-not-tonight.png', { type: 'image/png' })
            await navigator.share({ text: caption, files: [file] })
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                source: 'rejection-appeal',
                method: 'native-share-with-file',
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return
            console.error('[card-rejection] appeal share failed', err)
            Sentry.captureException(err, { tags: { feature: 'rejection-asset', action: 'appeal' } })
        } finally {
            setSharing(false)
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-6">
            <NavHeader title="Peanut Card" onPrev={onPrev} />

            <div className="flex flex-col gap-5">
                <ScaledRejectionAsset
                    ref={captureRef}
                    username={safeUsername}
                    mascot={mascot}
                    className="overflow-hidden rounded-sm border-2 border-black shadow-[0.25rem_0.25rem_0_#000]"
                />

                {/* Scarcity tally + appeal pitch — screen HTML, not on the asset */}
                <div className="flex flex-col gap-2 text-center">
                    <h1 className="text-2xl font-extrabold text-n-1">the door&apos;s tight tonight.</h1>
                    <p className="text-grey-1">
                        <span className="font-extrabold text-n-1">{applicants.toLocaleString('en-US')}</span> tried ·{' '}
                        <span className="font-extrabold text-n-1">{admitted}</span> got in.
                    </p>
                    <p className="text-grey-1">
                        tweet and tag <span className="font-extrabold text-n-1">@joinpeanut</span> to appeal.
                        <br />
                        come back tomorrow
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {joinError && <ErrorAlert description={joinError} />}
                <Button
                    onClick={handleAppeal}
                    loading={sharing}
                    disabled={sharing || joining}
                    variant="purple"
                    shadowSize="4"
                    className="w-full"
                >
                    Tweet to appeal
                </Button>
                <Button
                    onClick={handleJoin}
                    loading={joining}
                    disabled={joining || sharing}
                    variant="stroke"
                    className="w-full"
                >
                    Join the waitlist anyway
                </Button>
            </div>
        </div>
    )
}

export default CardRejectionScreen
