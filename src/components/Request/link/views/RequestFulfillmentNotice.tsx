'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import Badge from '@/components/Global/Badges/Badge'
import { requestsApi } from '@/services/requests'
import { formatTokenAmount } from '@/utils/general.utils'
import { useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { requestFulfillmentState, requestIsSettled } from '../requestFulfillment'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useEffect, useRef } from 'react'

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
    const queryClient = useQueryClient()

    const { data } = useQuery({
        queryKey: [...REQUEST_FULFILLMENT_QUERY_KEY, requestId],
        enabled: bankPayable,
        queryFn: () => requestsApi.get(requestId),
        refetchInterval: REQUEST_FULFILLMENT_POLL_MS,
    })

    const state = data ? requestFulfillmentState(data) : null
    const lastObservedBankPayment = useRef<string | null>(null)
    useEffect(() => {
        if (!state || state === 'unpaid') return
        // The API serializes one request's Decimal amount consistently. Keep
        // its string form so comparisons never round money through Number.
        const bankPayment = `${requestId}:${state}:${data?.receivedAmount ?? ''}`
        if (bankPayment === lastObservedBankPayment.current) return
        lastObservedBankPayment.current = bankPayment
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [data?.receivedAmount, queryClient, requestId, state])

    if (!data || !state) return null

    // This row reports the bank transfer, so no bank money means no row — a
    // request paid entirely inside Peanut has nothing to say here.
    if (state === 'unpaid') return null
    // Whether anything is still OWED is a question about the request, not about
    // the bank. A request settled by a bank transfer plus a Peanut payment is
    // paid in full, and "Partly paid" would ask for the money twice.
    const settled = requestIsSettled(data)

    const received = formatTokenAmount(data.receivedAmount ?? '0', 2) ?? data.receivedAmount ?? '0'
    const requested = formatTokenAmount(data.tokenAmount, 2) ?? data.tokenAmount ?? '0'

    // A part payment states both numbers, because the requester's next move is
    // to ask for the difference. A paid request states who paid instead: the
    // amount is settled, and the name is the only fact left that the requester
    // does not already know.
    const paidValue = data.payerName ? t('paidByBank.paidByName', { name: data.payerName }) : t('paidByBank.paidByBank')

    // Three things the row can say, in the order they stop being ambiguous:
    // the bank paid all of it (name the payer), the bank paid part of a request
    // that is settled anyway (say where the rest came from), or money is still
    // owed (state both numbers, because asking for the difference is next).
    let value: string
    if (state === 'paid') value = paidValue
    else if (settled) value = t('paidByBank.receivedPartialSettled', { received, requested })
    else value = t('paidByBank.receivedPartial', { received, requested })

    const owesNothing = state === 'paid' || settled

    return (
        <Card position="solo" className="w-full px-4 py-0">
            <DataRow
                label={t('paidByBank.rowLabel')}
                value={value}
                trailing={
                    <Badge
                        status={owesNothing ? 'completed' : 'pending'}
                        customText={owesNothing ? t('paidByBank.badgePaid') : t('paidByBank.badgePartial')}
                    />
                }
            />
        </Card>
    )
}
