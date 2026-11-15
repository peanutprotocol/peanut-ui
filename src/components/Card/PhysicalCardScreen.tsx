'use client'

import { formatFiniteDisplay } from '@/utils/currency'
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
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { PILL_THUMB } from '@/components/0_Bruddle/PillSurface'

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

    const badge = isLoading
        ? null
        : data?.joinedAt
          ? data.position === null
              ? t('onListBadge')
              : t('positionBadge', { position: formatFiniteDisplay(data.position) })
          : t('notAvailableBadge')

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />

            <div className="relative">
                <CardFace last4={last4} isVirtual={false} className="grayscale" />
                {badge && (
                    <span
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 text-body-m-semibold whitespace-nowrap text-foreground-primary ${PILL_THUMB}`}
                    >
                        {badge}
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center gap-6 text-center" role="status">
                    <span className="sr-only">{tCommon('loading')}</span>
                    <div className="flex w-full flex-col items-center gap-1">
                        <div className="h-8 w-40 animate-pulse rounded bg-background-skeleton" />
                        <div className="h-5 w-64 animate-pulse rounded bg-background-skeleton" />
                    </div>
                    <div className="h-11 w-full animate-pulse rounded-full bg-background-skeleton" />
                </div>
            ) : data?.joinedAt ? (
                <TitleBlock title={<h1>{t('onListTitle')}</h1>} description={t('onListBody')} align="center" size="s" />
            ) : (
                <>
                    <TitleBlock title={<h1>{t('comingSoonTitle')}</h1>} description={t('comingSoonBody')} size="s" />
                    <NumberedList items={[t('stepJoin'), t('stepNotify'), t('stepShip')]} />
                    {error && <Callout priority="error">{error}</Callout>}
                    <Button variant="primary" className="w-full" onClick={onJoin} loading={joining} disabled={joining}>
                        {t('joinCta')}
                    </Button>
                </>
            )}
        </PageStack>
    )
}

export default PhysicalCardScreen
