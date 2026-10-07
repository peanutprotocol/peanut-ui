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
import { REQUEST_FULFILLMENT, REQUEST_FULFILLMENT_POLL_MS, TRANSACTIONS } from '@/constants/query.consts'
import { useEffect, useRef } from 'react'

export const REQUEST_FULFILLMENT_QUERY_KEY = [REQUEST_FULFILLMENT] as const

export { REQUEST_FULFILLMENT_POLL_MS } from '@/constants/query.consts'

/** Watch every request, including balance/crypto payments. Socket pushes invalidate
 * this query centrally; visible-screen polling recovers missed pushes. */
export function RequestFulfillmentNotice({ requestId }: { requestId: string; bankPayable?: boolean }) {
    const t = useTranslations('request')
    const queryClient = useQueryClient()

    const { data } = useQuery({
        queryKey: [...REQUEST_FULFILLMENT_QUERY_KEY, requestId],
        queryFn: () => requestsApi.get(requestId),
        refetchInterval: REQUEST_FULFILLMENT_POLL_MS,
        refetchOnWindowFocus: 'always',
    })

    const state = data ? requestFulfillmentState(data) : null
    const fromCharges = data?.totalCollectedAmount ?? 0
    const lastObservedPayment = useRef<string | null>(null)
    useEffect(() => {
        if (!data || !state || (state === 'unpaid' && !(fromCharges > 0) && !requestIsSettled(data))) return
        // The API serializes one request's Decimal amount consistently. Keep
        // its string form so comparisons never round money through Number.
        const payment = `${requestId}:${state}:${data?.receivedAmount ?? ''}:${fromCharges}:${data?.paidAt ?? ''}`
        if (payment === lastObservedPayment.current) return
        lastObservedPayment.current = payment
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [data, fromCharges, queryClient, requestId, state])

    if (!data || !state) return null

    if (state === 'unpaid') {
        const settled = requestIsSettled(data)
        if (!(fromCharges > 0) && !settled) return null
        const asked = Number(data.tokenAmount)
        const paid = settled || !data.tokenAmount || (Number.isFinite(asked) && fromCharges >= asked)
        return (
            <Card position="solo" className="w-full px-4 py-0">
                <DataRow
                    label={t('paymentReceived.rowLabel')}
                    value={
                        paid
                            ? t('paymentReceived.received')
                            : t('paidByBank.receivedPartial', {
                                  received: formatTokenAmount(String(fromCharges), 2) ?? String(fromCharges),
                                  requested: formatTokenAmount(data.tokenAmount, 2) ?? data.tokenAmount,
                              })
                    }
                    trailing={
                        <Badge
                            status={paid ? 'completed' : 'pending'}
                            customText={t(paid ? 'paidByBank.badgePaid' : 'paidByBank.badgePartial')}
                        />
                    }
                />
            </Card>
        )
    }
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
