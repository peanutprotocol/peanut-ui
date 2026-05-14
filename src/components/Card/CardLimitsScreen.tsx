'use client'
import { type FC, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import CardLimitEditModal, { CARD_LIMITS_QUERY_KEY } from '@/components/Card/CardLimitEditModal'
import { rainApi, type RainCardLimit } from '@/services/rain'

interface Props {
    cardId: string
    onPrev?: () => void
}

// Product decision: only expose the per-transaction limit. Rain's API supports
// additional frequencies (daily / monthly / all-time) but we don't currently
// surface them. Add back to this list if/when product wants more.
const FREQUENCY = 'perAuthorization' as const
const LABEL = 'Per transaction'

const formatDollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const CardLimitsScreen: FC<Props> = ({ cardId, onPrev }) => {
    const [isEditing, setIsEditing] = useState(false)

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
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Card limit" onPrev={onPrev} />
            <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Set your per-transaction spending limit.</h2>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loading />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <p className="text-sm text-grey-1">Failed to load card limit.</p>
                        <Button variant="stroke" onClick={() => refetch()}>
                            Retry
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-sm border border-n-1 bg-white px-4 py-3">
                        <div>
                            <div className="text-sm text-grey-1">{LABEL}</div>
                            <div className="text-base font-bold">
                                {amount != null ? formatDollars(amount) : 'No limit set'}
                            </div>
                        </div>
                        <button type="button" onClick={() => setIsEditing(true)} className="text-black underline">
                            Edit
                        </button>
                    </div>
                )}
            </div>

            <CardLimitEditModal
                cardId={cardId}
                frequency={FREQUENCY}
                label={LABEL}
                initialAmountCents={amount}
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
            />
        </div>
    )
}

export default CardLimitsScreen
