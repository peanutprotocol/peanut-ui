'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { requestsApi } from '@/services/requests'
import { formatTokenAmount } from '@/utils/general.utils'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { requestFulfillmentState } from '../requestFulfillment'

export const REQUEST_FULFILLMENT_QUERY_KEY = ['request-fulfillment'] as const

/** how often the requester's screen asks whether the money arrived */
export const REQUEST_FULFILLMENT_POLL_MS = 15_000

/**
 * Whether a bank deposit answered this request, on the requester's own screen.
 *
 * Only a request that shares bank details can be paid this way, so only one
 * polls. A request answered inside Peanut reports itself through the charge it
 * created and needs nothing here.
 */
export function RequestFulfillmentNotice({ requestId, bankPayable }: { requestId: string; bankPayable: boolean }) {
    const t = useTranslations('request')

    const { data } = useQuery({
        queryKey: [...REQUEST_FULFILLMENT_QUERY_KEY, requestId],
        enabled: bankPayable,
        queryFn: () => requestsApi.get(requestId),
        refetchInterval: REQUEST_FULFILLMENT_POLL_MS,
    })

    if (!data) return null

    const state = requestFulfillmentState(data)
    if (state === 'unpaid') return null

    const received = formatTokenAmount(data.receivedAmount ?? '0', 2) ?? data.receivedAmount ?? '0'
    const requested = formatTokenAmount(data.tokenAmount, 2) ?? data.tokenAmount ?? '0'

    // A part payment states both numbers, because the requester's next move is
    // to ask for the difference. A paid request states who paid instead: the
    // amount is settled, and the name is the only fact left that the requester
    // does not already know.
    const paidValue = data.payerName ? t('paidByBank.paidByName', { name: data.payerName }) : t('paidByBank.paidByBank')

    return (
        <Card position="single" className="w-full px-4 py-0">
            <DataRow
                label={t('paidByBank.rowLabel')}
                value={state === 'paid' ? paidValue : t('paidByBank.receivedPartial', { received, requested })}
                trailing={
                    <StatusBadge
                        status={state === 'paid' ? 'completed' : 'pending'}
                        customText={state === 'paid' ? t('paidByBank.badgePaid') : t('paidByBank.badgePartial')}
                    />
                }
            />
        </Card>
    )
}
