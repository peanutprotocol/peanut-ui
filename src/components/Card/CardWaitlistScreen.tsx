'use client'

/**
 * <CardWaitlistScreen /> — shown to users who passed the eligibility
 * check but don't hold a skip badge AND haven't joined the waitlist yet.
 *
 * Tone: gentle let-down, not a wall. Sad peanut SVG (animated), one-line
 * "you don't have the required badge" headline, soft "but you can join
 * the waitlist" pitch, single CTA. No skip-the-line gallery here — the
 * goal is conversion to waitlist, not badge-hunting.
 *
 * Once joined, the /card state machine routes to <CardWaitlistJoinedScreen />.
 */

import { type FC, useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { SadPeanut } from '@/components/Card/SadPeanut'
import ErrorAlert from '@/components/Global/ErrorAlert'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'

interface Props {
    cardInfo: CardInfoResponse
    onPrev?: () => void
    /** Called after the user joins. Parent should refetch /card. */
    onJoined?: () => void
}

const CardWaitlistScreen: FC<Props> = ({ onPrev, onJoined }) => {
    const [joining, setJoining] = useState(false)
    const [joinError, setJoinError] = useState<string | null>(null)

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
            const message = e instanceof Error ? e.message : 'Failed to join waitlist'
            setJoinError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOIN_FAILED, { error_message: message })
        } finally {
            setJoining(false)
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Peanut Card" onPrev={onPrev} />

            <div className="my-auto flex flex-col items-center gap-6 text-center">
                <SadPeanut size={180} />

                <div className="flex flex-col gap-3">
                    <h1 className="text-2xl font-extrabold text-n-1">
                        You don&apos;t have the required badge :(
                    </h1>
                    <p className="text-grey-1">
                        Instead, you can join the waitlist. We let in a few people every week.
                    </p>
                </div>
            </div>

            {joinError && <ErrorAlert description={joinError} />}

            <Button
                onClick={handleJoin}
                loading={joining}
                disabled={joining}
                variant="purple"
                shadowSize="4"
                className="w-full"
            >
                Join the waitlist
            </Button>
        </div>
    )
}

export default CardWaitlistScreen
