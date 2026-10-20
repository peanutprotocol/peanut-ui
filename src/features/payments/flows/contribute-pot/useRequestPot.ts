'use client'

import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
    const queryClient = useQueryClient()
    const requestQuery = useQuery({
        queryKey: [...REQUEST_POT_QUERY_KEY, uuid],
        queryFn: () => requestsApi.get(uuid),
        // the page wrapper has just read it
        initialData: initialRequest,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })

    // `initialData` only seeds an empty cache. A payer who reopens the same pot
    // within 30 s would get the cached request from the last visit, older than
    // the read the page wrapper just made, beside a fresh remainder. The
    // wrapper's read is the newest there is, so it replaces the cache: one
    // write, no second request.
    useEffect(() => {
        queryClient.setQueryData([...REQUEST_POT_QUERY_KEY, initialRequest.uuid], initialRequest)
    }, [queryClient, initialRequest])
    const { payAmounts, refetch: refetchPayAmounts } = useRequestPayAmounts(uuid)
    const { refetch: refetchRequest } = requestQuery

    const refetch = useCallback(async () => {
        await Promise.all([refetchRequest(), refetchPayAmounts()])
    }, [refetchRequest, refetchPayAmounts])

    return { request: requestQuery.data, payAmounts, refetch }
}
