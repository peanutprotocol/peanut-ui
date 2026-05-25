'use client'

/**
 * <CardWaitlistJoinedScreen /> — confirmation screen after the user has
 * joined the waitlist. Replaces the prior inline "You're #N in line" +
 * disabled-button-as-status pattern.
 *
 * No position display. We intentionally don't surface the queue position
 * because:
 *   1. The BE counter is best-effort (race with admin grants, churn).
 *   2. A specific number invites speculation about timing we can't honor.
 *
 * CTA: back to /home. The user keeps the joined state — coming back to
 * /card later still lands here until they're released into the funnel.
 */

import { type FC, useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    onPrev?: () => void
}

const CardWaitlistJoinedScreen: FC<Props> = ({ onPrev }) => {
    const router = useRouter()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_VIEWED, { already_joined: true })
    }, [])

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Peanut Card" onPrev={onPrev} />

            <div className="my-auto flex flex-col items-center gap-6 text-center">
                <div
                    className="flex items-center justify-center rounded-full border-2 border-n-1 bg-primary-1"
                    style={{ width: 96, height: 96, boxShadow: '0.375rem 0.375rem 0 #000' }}
                >
                    <span className="text-5xl" aria-hidden>
                        🥜
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    <h1 className="text-2xl font-extrabold text-n-1">You&apos;re on the waitlist</h1>
                    <p className="text-grey-1">
                        We&apos;ll let you know when it&apos;s your turn. Until then, keep using Peanut.
                    </p>
                </div>
            </div>

            <Button onClick={() => router.push('/home')} variant="purple" shadowSize="4" className="w-full">
                Back to home
            </Button>
        </div>
    )
}

export default CardWaitlistJoinedScreen
