'use client'

import { requestsApi } from '@/services/requests'
import { useQuery } from '@tanstack/react-query'

export const REQUEST_PAY_AMOUNTS_QUERY_KEY = ['request-pay-amounts'] as const

/**
 * What one request still needs on each rail the requester can receive on, in
 * that rail's own currency.
 *
 * `payAmounts` stays undefined while it loads, when the request is gone, when
 * the API predates the route, and when the call fails. The pay screen works in
 * each of those cases: it lists its rails with no per-rail amounts, as it did
 * before the route existed. So a failure here is never shown as an error.
 */
export function useRequestPayAmounts(uuid: string | undefined) {
    const query = useQuery({
        queryKey: [...REQUEST_PAY_AMOUNTS_QUERY_KEY, uuid],
        enabled: !!uuid,
        queryFn: () => requestsApi.payAmounts(uuid!),
        retry: false,
    })

    return { payAmounts: query.data ?? undefined, isLoading: query.isLoading }
}
