'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import Badge from '@/components/Global/Badges/Badge'
import { REQUEST_FULFILLMENT, REQUEST_FULFILLMENT_POLL_MS, TRANSACTIONS } from '@/constants/query.consts'
import { chargesApi } from '@/services/charges'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

/** A targeted request creates a charge, rather than a shareable request link. */
export function ChargeFulfillmentNotice({ chargeId }: { chargeId: string }) {
    const t = useTranslations('request')
    const client = useQueryClient()
    const { data } = useQuery({
        queryKey: [REQUEST_FULFILLMENT, 'charge', chargeId],
        queryFn: () => chargesApi.get(chargeId),
        refetchInterval: (query) =>
            query.state.data?.fulfillmentPayment?.status === 'SUCCESSFUL' ? false : REQUEST_FULFILLMENT_POLL_MS,
        refetchOnWindowFocus: 'always',
    })
    const paid = data?.fulfillmentPayment?.status === 'SUCCESSFUL'
    useEffect(() => {
        if (paid) void client.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [paid, chargeId, client])
    if (!paid) return null
    return (
        <Card position="solo" className="w-full px-4 py-0">
            <DataRow
                label={t('paymentReceived.rowLabel')}
                value={t('paymentReceived.received')}
                trailing={<Badge status="completed" customText={t('paidByBank.badgePaid')} />}
            />
        </Card>
    )
}
