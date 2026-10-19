'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requestsApi } from '@/services/requests'
import { type TRequestResponse } from '@/services/services.types'
import { useRequestPayAmounts } from '@/components/Request/Pay/useRequestPayAmounts'

const REQUEST_POT_QUERY_KEY = ['request-pot'] as const

/**
 * The request a pot payer is paying, and what it still needs, read as one.
 *
 * The contributors come from the request and the remainder from
 * `/pay-amounts`. The request used to be read once at page load while the
 * remainder refetched, so after somebody else paid the screen knew the new
 * remainder but not the new contributor, and suggested the whole remainder
 * (TASK-23856). `refetch` reads both again together.
 */
export function useRequestPot(initialRequest: TRequestResponse) {
    const uuid = initialRequest.uuid
    const requestQuery = useQuery({
        queryKey: [...REQUEST_POT_QUERY_KEY, uuid],
        queryFn: () => requestsApi.get(uuid),
        // the page wrapper has just read it
        initialData: initialRequest,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })
    const { payAmounts, refetch: refetchPayAmounts } = useRequestPayAmounts(uuid)
    const { refetch: refetchRequest } = requestQuery

    const refetch = useCallback(async () => {
        await Promise.all([refetchRequest(), refetchPayAmounts()])
    }, [refetchRequest, refetchPayAmounts])

    return { request: requestQuery.data, payAmounts, refetch }
}
