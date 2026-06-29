import { useCallback, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { GateAdvisory } from '@/utils/capability-gate'

type UpliftChannel = 'deposit' | 'withdraw'

/**
 * Fires the EEA-uplift funnel events for PostHog so the flow can be filtered
 * directly: `eea_uplift_started` when the user launches the verification, and
 * `eea_uplift_completed` on KYC success.
 *
 * `trackCompleted` only emits if a start was recorded in this session — the KYC
 * success callback on the bank pages is shared with non-uplift KYC, so the
 * `startedRef` guard stops a generic success from mis-firing the completed
 * event. The advisory snapshot is captured at start time because the gate's
 * `advisory` clears once the requirement resolves, so it's gone by completion.
 */
export function useEeaUpliftFunnel(channel: UpliftChannel) {
    const startedRef = useRef<GateAdvisory | null>(null)

    const trackStarted = useCallback(
        (advisory: GateAdvisory | undefined) => {
            startedRef.current = advisory ?? null
            posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_STARTED, {
                channel,
                requirement_key: advisory?.requirementKey,
                action_key: advisory?.actionKey,
                effective_date: advisory?.effectiveDate,
            })
        },
        [channel]
    )

    const trackCompleted = useCallback(() => {
        const advisory = startedRef.current
        if (!advisory) return
        startedRef.current = null
        posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_COMPLETED, {
            channel,
            requirement_key: advisory.requirementKey,
            action_key: advisory.actionKey,
            effective_date: advisory.effectiveDate,
        })
    }, [channel])

    return { trackStarted, trackCompleted }
}
