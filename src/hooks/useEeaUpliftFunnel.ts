import { useCallback, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { UpliftStartTrigger } from '@/utils/eea-uplift.utils'

type UpliftChannel = 'deposit' | 'withdraw'

function upliftEventProps(channel: UpliftChannel, trigger: UpliftStartTrigger) {
    return {
        channel,
        requirement_key: trigger.requirementKey,
        action_key: trigger.actionKey,
        effective_date: trigger.effectiveDate,
        source: trigger.source,
        // blocking = the cliff date has passed → already gating → urgent.
        urgent: trigger.source === 'blocking',
    }
}

function sameTrigger(a: UpliftStartTrigger | null, b: UpliftStartTrigger): boolean {
    return !!a && a.requirementKey === b.requirementKey && a.source === b.source
}

/**
 * Fires the EEA-uplift funnel events for PostHog so the flow can be filtered
 * directly (and session recordings tagged): `eea_uplift_started` when the uplift
 * modal OPENS, and `eea_uplift_completed` on KYC success.
 *
 * Firing on modal-open (not on the modal's CTA) means abandoners are captured
 * too — the whole point is to watch who attempts the uplift and whether they
 * finish. `trackStarted` is idempotent per armed attempt: re-clicking Continue
 * while the same requirement is already latched does not re-emit `started`
 * (until `reset`/`trackCompleted` clears the latch, at which point a genuine new
 * attempt fires again).
 *
 * `trackCompleted` only emits if a start was recorded in this session: the KYC
 * success callback on the bank pages is shared with non-uplift KYC, so the
 * latch stops a generic success from mis-firing `completed`. The trigger
 * snapshot is captured at start because the gate's advisory/reason clears once
 * the requirement resolves, so it's gone by completion.
 *
 * `reset` clears the pending start on abandonment (uplift modal dismissed
 * without success), so a later unrelated KYC success can't mis-fire.
 */
export function useEeaUpliftFunnel(channel: UpliftChannel) {
    const startedRef = useRef<UpliftStartTrigger | null>(null)

    const trackStarted = useCallback(
        (trigger: UpliftStartTrigger) => {
            // idempotent per armed attempt — don't re-emit on repeat clicks.
            if (sameTrigger(startedRef.current, trigger)) return
            startedRef.current = trigger
            posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_STARTED, upliftEventProps(channel, trigger))
        },
        [channel]
    )

    const trackCompleted = useCallback(() => {
        const trigger = startedRef.current
        if (!trigger) return
        startedRef.current = null
        posthog.capture(ANALYTICS_EVENTS.EEA_UPLIFT_COMPLETED, upliftEventProps(channel, trigger))
    }, [channel])

    const reset = useCallback(() => {
        startedRef.current = null
    }, [])

    return { trackStarted, trackCompleted, reset }
}
