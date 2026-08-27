'use client'

import { ESendLinkStatus, sendLinksApi, type SendLink } from '@/services/sendLinks'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export const CLAIM_POLL_INTERVAL_MS = 1000
export const CLAIM_POLL_SLOW_INTERVAL_MS = 10_000
export const FAST_CLAIM_POLL_ATTEMPTS = 30
// 30 fast attempts (~30s) + 30 slow ones (~5min) before giving up
export const MAX_CLAIM_POLL_ATTEMPTS = 60

/*
 * Terminal means "polling again can't change the answer". A projected claim
 * counts only WITH its txHash: the claim write flips SendLink.status to
 * CLAIMED before the claim intent is projected, so {status: CLAIMED, claim:
 * undefined} is a transient state we must keep polling through — treating it
 * as terminal would stop before the hash ever arrives.
 */
const isTerminal = (link: SendLink | undefined): boolean =>
    !!link &&
    (!!link.claim?.txHash || link.status === ESendLinkStatus.FAILED || link.status === ESendLinkStatus.CANCELLED)

/**
 * Polls the send link after an optimistic claim until the claim tx is indexed.
 * react-query owns the cadence: in-flight requests are deduped (a bare
 * setInterval here once piled up 89 concurrent GETs on a slow Android
 * connection), gcTime 0 stops polling on unmount, and after the fast phase the
 * interval backs off. If the attempt ceiling is reached without a terminal
 * answer (e.g. prolonged connectivity loss), onGaveUp fires so the view can
 * settle into its unconfirmed state instead of polling being lost silently.
 * Exactly one of onClaimed / onFailed / onGaveUp is reported — except that a
 * terminal response already in flight when the ceiling hits may still deliver
 * its onClaimed/onFailed after onGaveUp, which callers treat as an upgrade.
 */
export function useClaimSuccessPolling(
    link: string,
    enabled: boolean,
    onClaimed: (txHash: string) => void,
    onFailed: (reason?: string) => void,
    onGaveUp: () => void
): void {
    const attempts = useRef(0)
    const hasReportedResult = useRef(false)
    const hasReportedGiveUp = useRef(false)
    const onClaimedRef = useRef(onClaimed)
    const onFailedRef = useRef(onFailed)
    const onGaveUpRef = useRef(onGaveUp)
    onClaimedRef.current = onClaimed
    onFailedRef.current = onFailed
    onGaveUpRef.current = onGaveUp

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
            if (isTerminal(query.state.data)) return false
            if (attempts.current >= MAX_CLAIM_POLL_ATTEMPTS) {
                if (!hasReportedResult.current && !hasReportedGiveUp.current) {
                    hasReportedGiveUp.current = true
                    onGaveUpRef.current()
                }
                return false
            }
            return attempts.current < FAST_CLAIM_POLL_ATTEMPTS ? CLAIM_POLL_INTERVAL_MS : CLAIM_POLL_SLOW_INTERVAL_MS
        },
    })

    useEffect(() => {
        if (!data || hasReportedResult.current) return
        if (data.claim?.txHash) {
            hasReportedResult.current = true
            onClaimedRef.current(data.claim.txHash)
        } else if (data.status === ESendLinkStatus.FAILED) {
            hasReportedResult.current = true
            onFailedRef.current(data.events?.[data.events.length - 1]?.reason)
        }
    }, [data])
}
