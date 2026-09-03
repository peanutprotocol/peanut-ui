'use client'

import { ESendLinkStatus, sendLinksApi, type SendLink } from '@/services/sendLinks'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export const CLAIM_POLL_INTERVAL_MS = 1000
export const CLAIM_POLL_SLOW_INTERVAL_MS = 10_000
export const FAST_CLAIM_POLL_ATTEMPTS = 30
// 30 fast attempts (~30s) + 30 slow ones (~5min) before giving up
export const MAX_CLAIM_POLL_ATTEMPTS = 60

export type ClaimPollFailure = { code: string | null; reason?: string }

/*
 * Terminal means "polling again can't change the answer". A CLAIMED status is
 * the same signal that fires the claim notification — peanut-api-ts marks the
 * SendLink CLAIMED and runs processPostClaim (which sends the push) once the
 * claim tx is handled — so the money has moved and we settle on it, whether or
 * not the claim intent's txHash has projected yet. The hash still counts on its
 * own for any path that carries it before the status flips.
 */
const isTerminal = (link: SendLink | undefined): boolean =>
    !!link &&
    (!!link.claim?.txHash ||
        link.status === ESendLinkStatus.CLAIMED ||
        link.status === ESendLinkStatus.FAILED ||
        link.status === ESendLinkStatus.CANCELLED)

const toFailure = (link: SendLink): ClaimPollFailure => ({
    code: link.claimFailureCode ?? null,
    reason: link.events?.[link.events.length - 1]?.reason,
})

/**
 * Polls the send link after an optimistic claim until the claim tx is indexed.
 * react-query owns the cadence: in-flight requests are deduped (a bare
 * setInterval here once piled up 89 concurrent GETs on a slow Android
 * connection), gcTime 0 stops polling on unmount, and after the fast phase the
 * interval backs off. If the attempt ceiling is reached without a terminal
 * answer (e.g. prolonged connectivity loss), onGaveUp fires so the view can
 * hold its unconfirmed state instead of polling being lost silently.
 * Exactly one of onClaimed / onFailed / onGaveUp is reported — except that a
 * terminal response already in flight when the ceiling hits may still deliver
 * its onClaimed/onFailed after onGaveUp, which callers treat as an upgrade.
 */
export function useClaimSuccessPolling(
    link: string,
    enabled: boolean,
    onClaimed: (txHash: string | null) => void,
    onFailed: (failure: ClaimPollFailure) => void,
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
        if (data.claim?.txHash || data.status === ESendLinkStatus.CLAIMED) {
            // CLAIMED without a projected txHash still settles as success: it is
            // the point the backend marks the claim done and notifies. Pass the
            // hash when it is already there, null when it has yet to project.
            hasReportedResult.current = true
            onClaimedRef.current(data.claim?.txHash ?? null)
        } else if (data.status === ESendLinkStatus.FAILED || data.status === ESendLinkStatus.CANCELLED) {
            // CANCELLED (sender withdrew mid-claim) has no distinct treatment
            // in the failure UI — it flows through onFailed like FAILED so the
            // view settles instead of holding "processing" forever.
            hasReportedResult.current = true
            onFailedRef.current(toFailure(data))
        }
    }, [data])
}
