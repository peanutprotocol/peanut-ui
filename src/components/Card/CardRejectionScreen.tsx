'use client'

/**
 * <CardRejectionScreen /> — the Berghain-style "not tonight" rejection.
 *
 * Shown to a user who passed the eligibility hold but doesn't hold a card-
 * access badge. Instead of a flat "you don't have the badge" wall, they get
 * a shareable door rejection: a dark "not tonight, <username>" asset with a
 * smug peanut bouncer, the scarcity tally as screen copy, and a primary
 * "Tweet to appeal" CTA that shares the asset (random caption tagging
 * @joinpeanut).
 *
 * This is the TERMINAL waitlist screen (no separate cooldown): once the user
 * has joined (`alreadyJoined`) the secondary "Join anyway" button becomes an
 * "on the list" confirmation, but the shareable asset + "Tweet to appeal"
 * stay so they can keep appealing / re-grab the asset.
 */

import { type FC, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { ScaledRejectionAsset } from '@/components/Card/share-asset/ScaledRejectionAsset'
import { captureShareAsset, canShareImageFiles } from '@/components/Card/share-asset/captureShareAsset'
import { pickRejectionCaption } from '@/components/Card/share-asset/rejectionCaptions'
import type { RejectionMascot } from '@/components/Card/share-asset/shareAsset.types'
import { computeDoorTally } from '@/components/Card/doorTally.utils'
import { cardApi } from '@/services/card'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    username?: string
    /** Real waitlist size (total who joined). The screen inflates this for the
     *  FOMO "tried" tally — mirrors the /shhhhh ScarcityCounter flex. Undefined
     *  while /card is still loading → a sane floor renders. */
    waitlistTotal?: number
    /** Real number admitted (released/granted). Shown verbatim as "got in". */
    admittedTotal?: number
    /** Which smug mascot the asset shows. */
    mascot?: RejectionMascot
    /** True once the user is already on the waitlist — swaps the "Join anyway"
     *  button for an "on the list" confirmation while keeping the asset + appeal. */
    alreadyJoined?: boolean
    onPrev?: () => void
    /** Called after the user joins the waitlist. Parent refetches /card; the
     *  user stays on this screen, now in its `alreadyJoined` state. */
    onJoined?: () => void
}

const CardRejectionScreen: FC<Props> = ({
    username,
    waitlistTotal,
    admittedTotal,
    mascot = 'cool',
    alreadyJoined = false,
    onPrev,
    onJoined,
}) => {
    // "tried" = real waitlist size, inflated for FOMO; "got in" = real admitted.
    // Deterministic (pure fn of the counts) so it never jitters between renders.
    const { applicants, admitted } = computeDoorTally(waitlistTotal, admittedTotal)
    const captureRef = useRef<HTMLDivElement | null>(null)
    const [sharing, setSharing] = useState(false)
    const [joining, setJoining] = useState(false)
    const [joinError, setJoinError] = useState<string | null>(null)
    // Local "just joined" override so the CTA swaps to the on-the-list state
    // immediately on a confirmed join, without waiting for the parent's /card
    // refetch (CodeRabbit). OR'd with the `alreadyJoined` prop.
    const [locallyJoined, setLocallyJoined] = useState(false)
    const showJoined = alreadyJoined || locallyJoined
    const safeUsername = (username || '').trim() || 'anon'

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_VIEWED, { already_joined: alreadyJoined })
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount with the entry state
    }, [])

    const handleJoin = async (): Promise<void> => {
        setJoinError(null)
        setJoining(true)
        try {
            const res = await cardApi.joinWaitlist()
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOINED, { position: res.position })
            setLocallyJoined(true)
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
        // Clear any stale "failed to join" error from an earlier handleJoin so
        // the success state can't render alongside it (CodeRabbit).
        setJoinError(null)
        const caption = pickRejectionCaption()

        // Appeal = tweet AND join the waitlist. Joining is NOT access — release
        // stays manual (admin grant) — it just drops the appealer into the
        // userId-keyed waitlist queue we grant from by hand, and flips them to
        // the friendly cooldown after they share. `source: 'appeal'` lets
        // PostHog tell appealers apart from quiet "Join anyway" joiners. Same
        // idempotent call the secondary button makes. Fire it in PARALLEL with
        // the capture, but defer onJoined() (which unmounts this screen) to the
        // finally so we never yank captureRef out from under captureShareAsset.
        const joined = cardApi
            .joinWaitlist()
            .then((res) => {
                posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOINED, { position: res.position, source: 'appeal' })
                setLocallyJoined(true)
            })
            .catch((e) => {
                // Non-fatal: the tweet still goes out, and the CARD_SHARE_ASSET_SHARED
                // appeal event is the backstop signal. They can also use "Join
                // the waitlist anyway".
                console.error('[card-rejection] appeal waitlist-join failed', e)
                posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOIN_FAILED, {
                    error_name: e instanceof Error ? e.name : 'unknown',
                    source: 'appeal',
                })
            })

        // Text-only appeal: opens the X composer with the caption (which tags
        // @joinpeanut). The image doesn't attach via the intent URL, but the
        // tag — the point of the appeal — still goes out.
        const tweetIntent = (method: string): void => {
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, { source: 'rejection-appeal', method })
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`, '_blank', 'noopener')
        }

        setSharing(true)
        try {
            // Desktop / no file-share support, or the asset hasn't rendered yet
            // (an unmeasured ref is not an error) → text-only intent.
            if (!canShareImageFiles()) return tweetIntent('twitter-intent-fallback')
            const node = captureRef.current
            if (!node) return tweetIntent('twitter-intent-unmeasured')

            const blob = await captureShareAsset(node)
            const file = new File([blob], 'peanut-not-tonight.png', { type: 'image/png' })
            await navigator.share({ text: caption, files: [file] })
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                source: 'rejection-appeal',
                method: 'native-share-with-file',
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return
            // Capture/native-share genuinely failed (html-to-image error or an
            // OS share-sheet refusal). The appeal is the whole point of this
            // screen — don't drop it silently; fall back to the text-only tweet.
            console.error('[card-rejection] appeal share failed; falling back to intent', err)
            Sentry.captureException(err, { tags: { feature: 'rejection-asset', action: 'appeal' } })
            tweetIntent('twitter-intent-error-fallback')
        } finally {
            setSharing(false)
            // Now that the capture/share UI is done, refetch /card. onJoined()
            // only shows the cooldown screen if the join actually persisted —
            // a failed join leaves them here (no lying "you're in"), able to
            // retry via "Join the waitlist anyway".
            await joined
            onJoined?.()
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
                {showJoined ? (
                    <div className="flex h-13 items-center justify-center gap-2 text-center text-sm font-bold text-n-1">
                        <Icon name="check-circle" size={18} />
                        You&apos;re on the list — we&apos;ll holler when it&apos;s your turn
                    </div>
                ) : (
                    <Button
                        onClick={handleJoin}
                        loading={joining}
                        disabled={joining || sharing}
                        variant="stroke"
                        className="w-full"
                    >
                        Join the waitlist anyway
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardRejectionScreen
