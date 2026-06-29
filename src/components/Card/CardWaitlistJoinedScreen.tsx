'use client'

/**
 * <CardWaitlistJoinedScreen /> — confirmation after the user has joined
 * the waitlist. Mirrors the canonical success layout used by
 * PaymentSuccessView / Send / Withdraw: chill-peanut gif floating above,
 * success Card with check-icon + headline, descriptive paragraph, CTA.
 *
 * No queue-position display. We intentionally don't surface the position
 * because the BE counter is best-effort (re-orders on admin grants /
 * churn), so a specific number invites speculation we can't honor.
 */

import { type FC, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { PeanutWhistling } from '@/assets/mascot'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { pickRejectionCaption } from '@/components/Card/share-asset/rejectionCaptions'

interface Props {
    onPrev?: () => void
}

const CardWaitlistJoinedScreen: FC<Props> = ({ onPrev }) => {
    const router = useRouter()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_VIEWED, { already_joined: true })
    }, [])

    // Beg to jump the queue — the same appeal as the rejection screen, minus the
    // waitlist-join (they're already on the list). Text-only X intent tagging
    // @joinpeanut; no asset to capture on the friendly cooldown screen.
    const handleAppeal = (): void => {
        const caption = pickRejectionCaption()
        posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
            source: 'waitlist-cooldown',
            method: 'twitter-intent',
        })
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`, '_blank', 'noopener')
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Peanut Card" onPrev={onPrev} />

            <div className="relative z-10 my-auto flex h-full flex-col justify-center space-y-4">
                <Image
                    src={PeanutWhistling.src}
                    unoptimized
                    alt="Peanut Mascot"
                    width={20}
                    height={20}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                        <Icon name="check" size={24} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-sm font-normal text-grey-1">You&apos;re on the waitlist</h1>
                        <p className="text-base font-extrabold text-n-1">
                            We&apos;ll let you know when it&apos;s your turn
                        </p>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <Button onClick={handleAppeal} variant="purple" shadowSize="4" className="w-full">
                    Tweet to appeal
                </Button>
                <Button onClick={() => router.push('/home')} variant="stroke" className="w-full">
                    Back to home
                </Button>
            </div>
        </div>
    )
}

export default CardWaitlistJoinedScreen
