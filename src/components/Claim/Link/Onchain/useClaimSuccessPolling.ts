'use client'

import { ESendLinkStatus, sendLinksApi, type SendLink } from '@/services/sendLinks'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export const CLAIM_POLL_INTERVAL_MS = 1000
export const MAX_CLAIM_POLL_ATTEMPTS = 60

const isTerminal = (link: SendLink | undefined): boolean =>
    !!link &&
    (!!link.claim ||
        link.status === ESendLinkStatus.CLAIMED ||
        link.status === ESendLinkStatus.FAILED ||
        link.status === ESendLinkStatus.CANCELLED)

/**
 * Polls the send link after an optimistic claim until the claim tx is indexed.
 * react-query owns the cadence: in-flight requests are deduped (a bare
 * setInterval here once piled up 89 concurrent GETs on a slow Android
 * connection), gcTime 0 stops polling on unmount, and the attempt cap gives up
 * on a link the indexer never resolves — the success UI is already shown, so
 * stopping silently matches the previous fallback behavior.
 */
export function useClaimSuccessPolling(
    link: string,
    enabled: boolean,
    onClaimed: (txHash: string) => void,
    onFailed: (reason?: string) => void
): void {
    const attempts = useRef(0)
    const hasHandledResult = useRef(false)
    const onClaimedRef = useRef(onClaimed)
    const onFailedRef = useRef(onFailed)
    onClaimedRef.current = onClaimed
    onFailedRef.current = onFailed

    const { data } = useQuery({
        queryKey: ['send-link-claim-status', link],
        queryFn: () => {
            attempts.current += 1
            return sendLinksApi.get(link)
        },
        enabled,
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchInterval: (query: { state: { data?: SendLink } }) => {
            if (isTerminal(query.state.data) || attempts.current >= MAX_CLAIM_POLL_ATTEMPTS) return false
            return CLAIM_POLL_INTERVAL_MS
        },
    })

    useEffect(() => {
        if (!data || hasHandledResult.current) return
        if (data.claim?.txHash) {
            hasHandledResult.current = true
            onClaimedRef.current(data.claim.txHash)
        } else if (data.status === ESendLinkStatus.FAILED) {
            hasHandledResult.current = true
            onFailedRef.current(data.events?.[data.events.length - 1]?.reason)
        }
    }, [data])
}
