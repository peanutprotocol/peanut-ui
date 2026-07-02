import { useCallback, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

type UpliftChannel = 'deposit' | 'withdraw'

/**
 * Describes the uplift attempt being started. `source` distinguishes the two
 * remediation paths (and, since blocking = the effective date has already
 * passed, doubles as the urgency signal): `blocking` is the urgent post-cliff
 * cohort, `advisory` is the future-dated ("upcoming") one.
 */
export type UpliftStartTrigger = {
    requirementKey?: string
    actionKey?: string
    effectiveDate?: string
    source: 'advisory' | 'blocking'
}

/**
 * Fires the EEA-uplift funnel events for PostHog so the flow can be filtered
 * directly (and session recordings tagged): `eea_uplift_started` when the uplift
 * modal OPENS, and `eea_uplift_completed` on KYC success.
 *
 * Firing on modal-open (not on the modal's CTA) means abandoners are captured
 * too — the whole point is to watch who attempts the uplift and whether they
 * finish. `trackCompleted` only emits if a start was recorded in this session:
 * the KYC success callback on the bank pages is shared with non-uplift KYC, so
 * the `startedRef` latch stops a generic success from mis-firing `completed`.
 * The trigger snapshot is captured at start because the gate's advisory/reason
 * clears once the requirement resolves, so it's gone by completion.
 *
 * `reset` clears the pending start on abandonment (KYC modal closed without
 * success), so a later unrelated KYC success on the same page can't mis-fire.
 */
export function useEeaUpliftFunnel(channel: UpliftChannel) {
    const startedRef = useRef<UpliftStartTrigger | null>(null)

    const eventProps = useCallback(
        (trigger: UpliftStartTrigger) => ({
            channel,
            requirement_key: trigger.requirementKey,
            action_key: trigger.actionKey,
            effective_date: trigger.effectiveDate,
            source: trigger.source,
            // blocking = the cliff date has passed → already gating → urgent.
            urgent: trigger.source === 'blocking',
        }),
        [channel]
    )

    const trackStarted = useCallback(
        (trigger: UpliftStartTrigger) => {
            startedRef.current = trigger
            posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_STARTED, eventProps(trigger))
        },
        [eventProps]
    )

    const trackCompleted = useCallback(() => {
        const trigger = startedRef.current
        if (!trigger) return
        startedRef.current = null
        posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_COMPLETED, eventProps(trigger))
    }, [eventProps])

    const reset = useCallback(() => {
        startedRef.current = null
    }, [])

    return { trackStarted, trackCompleted, reset }
}
