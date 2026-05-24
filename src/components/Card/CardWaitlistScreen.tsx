'use client'

import { type FC, useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import CardFace from '@/components/Card/CardFace'
import { Icon } from '@/components/Global/Icons/Icon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { cardApi, type CardInfoResponse } from '@/services/card'

interface Props {
    cardInfo: CardInfoResponse
    onPrev?: () => void
    /** Called after the user joins. Parent should refetch /card. */
    onJoined?: () => void
    /** Skip-badge codes the user does NOT yet have (full SKIP_BADGE_CODES minus user's). */
    missingSkipBadges?: string[]
}

// Friendly labels for the skip-badge gallery (BE owns the canonical codes).
const SKIP_BADGE_LABELS: Record<string, { name: string; how: string }> = {
    OG_2025_10_12: { name: 'Peanut OG', how: 'Already signed up before Oct 12, 2025' },
    DEVCONNECT_BA_2025: {
        name: 'Devconnect BA 2025',
        how: 'Find us at Devconnect Buenos Aires in November',
    },
    ARBIVERSE_DEVCONNECT_BA_2025: {
        name: 'Arbiverse @ Devconnect',
        how: 'Stop by the Arbiverse booth at Devconnect BA',
    },
}

const CardWaitlistScreen: FC<Props> = ({ cardInfo, onPrev, onJoined, missingSkipBadges = [] }) => {
    const [joining, setJoining] = useState(false)
    const [joinError, setJoinError] = useState<string | null>(null)
    const alreadyJoined = !!cardInfo.waitlistJoinedAt
    const position = cardInfo.waitlistPosition

    // Fire view event once per mount.
    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_VIEWED, {
            already_joined: alreadyJoined,
            position,
        })
    }, [alreadyJoined, position])

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

            <CardFace last4="0420" locked />

            <div className="flex flex-col gap-2">
                {alreadyJoined && position !== null ? (
                    <h1 className="text-2xl font-extrabold text-n-1">
                        You&apos;re #{position} in line
                    </h1>
                ) : (
                    <h1 className="text-2xl font-extrabold text-n-1">Join the waitlist</h1>
                )}
                <p className="text-grey-1">
                    We&apos;re letting people in slowly — about 20 a week during closed beta. Skip
                    the line with the right badge.
                </p>
            </div>

            {missingSkipBadges.length > 0 && (
                <div className="rounded-sm border border-n-1 bg-primary-3 p-4">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-n-1">
                        Skip the line
                    </h2>
                    <ul className="flex flex-col gap-3">
                        {missingSkipBadges.map((code) => {
                            const meta = SKIP_BADGE_LABELS[code] ?? {
                                name: code,
                                how: 'Earn this badge to skip the queue.',
                            }
                            return (
                                <li key={code} className="flex items-start gap-3">
                                    <Icon name="check-circle" size={16} />
                                    <span>
                                        <span className="font-bold text-n-1">{meta.name}</span>{' '}
                                        <span className="text-grey-1">— {meta.how}</span>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {joinError && <ErrorAlert description={joinError} />}

            {alreadyJoined ? (
                <Button variant="stroke" className="w-full" disabled>
                    You&apos;ll be notified when it&apos;s your turn
                </Button>
            ) : (
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
            )}
        </div>
    )
}

export default CardWaitlistScreen
