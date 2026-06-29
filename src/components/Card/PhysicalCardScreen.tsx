'use client'
import { type FC, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Image from 'next/image'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import CardFace from '@/components/Card/CardFace'
import { rainApi } from '@/services/rain'
import { PeanutWalking } from '@/assets/mascot'

export const PHYSICAL_WAITLIST_QUERY_KEY = 'rain-physical-waitlist'

interface Props {
    cardId: string
    last4: string
    onPrev?: () => void
}

const PhysicalCardScreen: FC<Props> = ({ cardId, last4, onPrev }) => {
    const queryClient = useQueryClient()
    const [joining, setJoining] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: [PHYSICAL_WAITLIST_QUERY_KEY, cardId],
        queryFn: () => rainApi.getPhysicalWaitlist(cardId),
        staleTime: 30_000,
    })

    // Fire once we know whether the user is already on the list — without that
    // signal the event is half-useful.
    const viewLoggedRef = useRef(false)
    useEffect(() => {
        if (isLoading || viewLoggedRef.current) return
        viewLoggedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.CARD_PHYSICAL_WAITLIST_VIEWED, {
            already_joined: !!data?.joinedAt,
            position: data?.position ?? null,
        })
    }, [isLoading, data])

    const onJoin = async () => {
        setJoining(true)
        setError(null)
        try {
            const result = await rainApi.joinPhysicalWaitlist(cardId)
            await queryClient.invalidateQueries({ queryKey: [PHYSICAL_WAITLIST_QUERY_KEY, cardId] })
            posthog.capture(ANALYTICS_EVENTS.CARD_PHYSICAL_WAITLIST_JOINED, { position: result.position })
            // Inline "You are on the list!" status (driven by data?.joinedAt
            // after the invalidate above) is the only confirmation now. The
            // separate "You are in!" modal that used to fire here rendered as
            // a stacked second confirmation over the inline status and ended
            // up positioned over the page chrome — see 2026-05-19 screenshot.
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to join waitlist')
        } finally {
            setJoining(false)
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Physical card" onPrev={onPrev} />

            <CardFace last4={last4} isVirtual={false} />

            {isLoading ? (
                <div className="flex justify-center py-6">
                    <Loading />
                </div>
            ) : data?.joinedAt ? (
                <div className="flex flex-col items-center gap-3 text-center">
                    <Image src={PeanutWalking} unoptimized alt="" aria-hidden className="h-32 w-auto" />
                    <h1 className="text-xl font-extrabold">You are on the list!</h1>
                    <p className="text-sm text-grey-1">
                        {`You are #${data.position} on the list. We'll let you know when cards are ready to be shipped.`}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-xl font-extrabold">Coming soon!</h1>
                        <p className="text-sm text-grey-1">Join our waiting list and be amongst the first to get it.</p>
                    </div>
                    {error && <p className="text-sm text-red">{error}</p>}
                    <Button
                        variant="purple"
                        shadowSize="4"
                        className="w-full"
                        onClick={onJoin}
                        loading={joining}
                        disabled={joining}
                    >
                        Join waiting list
                    </Button>
                </div>
            )}
        </div>
    )
}

export default PhysicalCardScreen
