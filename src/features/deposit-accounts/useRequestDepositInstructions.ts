'use client'

import { requestsApi } from '@/services/requests'
import { useQuery } from '@tanstack/react-query'

export const REQUEST_DEPOSIT_INSTRUCTIONS_QUERY_KEY = ['request-deposit-instructions'] as const

/**
 * The requester's bank details for one payment request, read only when the
 * payer asks for them.
 *
 * `enabled` is the whole access rule on this side: the request itself says
 * whether its requester opted in, so a request that did not is never asked
 * about. The backend refuses anyway — this only keeps a pointless 404 off
 * every pay screen.
 *
 * A 404 that does arrive is not an error. The requester may have turned the
 * option off, or retired the account, between the link going out and the payer
 * opening it. `isUnavailable` is that answer, and the screen offers the other
 * ways to pay rather than a failure.
 */
export function useRequestDepositInstructions(uuid: string | undefined, enabled: boolean) {
    const query = useQuery({
        queryKey: [...REQUEST_DEPOSIT_INSTRUCTIONS_QUERY_KEY, uuid],
        enabled: !!uuid && enabled,
        queryFn: () => requestsApi.depositInstructions(uuid!),
    })

    return {
        // `undefined` while it loads, `null` once the backend says there are
        // none — the screen must not read the second as the first.
        instructions: query.data ?? undefined,
        isLoading: query.isLoading,
        isUnavailable: query.data === null || query.isError,
    }
}
