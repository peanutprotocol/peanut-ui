'use client'
import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { type FC, useState } from 'react'
import { Section } from '@/components/0_Bruddle/Section'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import NavHeader from '@/components/Global/NavHeader'
import CardLimitEditDrawer, { CARD_LIMITS_QUERY_KEY } from '@/components/Card/CardLimitEditDrawer'
import { rainApi, type RainCardLimit } from '@/services/rain'

interface Props {
    cardId: string
    onPrev?: () => void
}

// Product decision: only expose the per-transaction limit. Rain's API supports
// additional frequencies (daily / monthly / all-time) but we don't currently
// surface them. Add back to this list if/when product wants more.
const FREQUENCY = 'perAuthorization' as const

const formatDollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const CardLimitsScreen: FC<Props> = ({ cardId, onPrev }) => {
    const t = useTranslations('card.limits')
    const tCommon = useTranslations('common')
    const [isEditing, setIsEditing] = useState(false)
    const label = t('perTransaction')

    const {
        data: limits,
        isLoading,
        error,
        refetch,
    } = useQuery<RainCardLimit[]>({
        queryKey: [CARD_LIMITS_QUERY_KEY, cardId],
        queryFn: () => rainApi.getCardLimits(cardId),
        staleTime: 10_000,
    })

    const amount = limits?.find((l) => l.frequency === FREQUENCY)?.amount

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <ScreenMark icon="credit-card" color="brand" />
            <Section title={t('subtitle')}>
                {isLoading ? (
                    <ListItem
                        position="single"
                        title={<span className="h-5 w-32 animate-pulse rounded bg-foreground-primary/10" />}
                        trailing={<span className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />}
                        chevron
                    />
                ) : error ? (
                    <Notification priority="error" ctas={[{ label: tCommon('retry'), onClick: () => void refetch() }]}>
                        {t('loadFailed')}
                    </Notification>
                ) : (
                    <ListItem
                        position="single"
                        title={label}
                        trailing={
                            <span className="text-body-m-semibold">
                                {amount != null ? formatDollars(amount) : t('noLimitSet')}
                            </span>
                        }
                        chevron
                        onClick={() => setIsEditing(true)}
                    />
                )}
            </Section>

            <CardLimitEditDrawer
                cardId={cardId}
                frequency={FREQUENCY}
                label={label}
                initialAmountCents={amount}
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
            />
        </PageStack>
    )
}

export default CardLimitsScreen
