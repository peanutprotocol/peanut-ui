'use client'
import { type FC, useEffect, useRef, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import CardFace from '@/components/Card/CardFace'
import { rainApi } from '@/services/rain'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'

export const PHYSICAL_WAITLIST_QUERY_KEY = 'rain-physical-waitlist'

interface Props {
    cardId: string
    last4: string
    onPrev?: () => void
}

const PhysicalCardScreen: FC<Props> = ({ cardId, last4, onPrev }) => {
    const t = useTranslations('card.physical')
    const tCommon = useTranslations('common')
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
            setError(e instanceof Error ? e.message : t('joinFailed'))
        } finally {
            setJoining(false)
        }
    }

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />

            <CardFace last4={last4} isVirtual={false} />

            {isLoading ? (
                <div className="flex flex-col items-center gap-6 text-center" role="status">
                    <span className="sr-only">{tCommon('loading')}</span>
                    <div className="flex w-full flex-col items-center gap-1">
                        <div className="h-8 w-40 animate-pulse rounded bg-foreground-primary/10" />
                        <div className="h-5 w-64 animate-pulse rounded bg-foreground-primary/10" />
                    </div>
                    <div className="h-11 w-full animate-pulse rounded-round bg-foreground-primary/10" />
                </div>
            ) : data?.joinedAt ? (
                <div className="flex flex-col items-center gap-3 text-center">
                    <PeanutMascot pose="walking" className={MASCOT_STATE_CLASS} />
                    {/* position is nullable, so do not render it until rain assigns one. */}
                    <TitleBlock
                        title={<h1>{t('onListTitle')}</h1>}
                        description={
                            data.position === null
                                ? t('onListBodyPending')
                                : t('onListBody', { position: data.position.toLocaleString() })
                        }
                        align="center"
                        size="s"
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center gap-6 text-center">
                    <TitleBlock
                        title={<h1>{t('comingSoonTitle')}</h1>}
                        description={t('comingSoonBody')}
                        align="center"
                        size="s"
                    />
                    {error && <Callout priority="error">{error}</Callout>}
                    <Button variant="primary" className="w-full" onClick={onJoin} loading={joining} disabled={joining}>
                        {t('joinCta')}
                    </Button>
                </div>
            )}
        </PageStack>
    )
}

export default PhysicalCardScreen
