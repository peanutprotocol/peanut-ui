'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { useKycFeatureActivation } from './useKycFeatureActivation'

type Activation = ReturnType<typeof useKycFeatureActivation>
type WaitOutcome = 'opened' | 'timed_out' | 'failed' | 'left'

function outcomeOf(activation: Activation): WaitOutcome {
    if (activation.allowed) return 'opened'
    const report = activation.selectedStatus ?? (activation.result?.kind === 'report' ? activation.result.report : null)
    if (report?.state === 'pending' || report?.state === 'setting_up') return 'timed_out'
    return 'failed'
}

/**
 * How long a user waits on the account progress screen, and how the wait ends (TASK-25059): the
 * wait is the screen's whole point, so its length is what the screen is judged by.
 */
export function useLocalAccountWaitTracking(activation: Activation, currency: string | undefined) {
    const wait = useRef<{ startedAt: number; currency?: string } | null>(null)
    const latest = useRef(activation)
    latest.current = activation
    const { settling } = activation

    useEffect(() => {
        if (settling && !wait.current) {
            wait.current = { startedAt: Date.now(), currency }
            posthog.capture(ANALYTICS_EVENTS.LOCAL_ACCOUNT_WAIT_STARTED, {
                currency,
                found_pending: !!latest.current.selectedStatus,
            })
        } else if (!settling && wait.current) {
            posthog.capture(ANALYTICS_EVENTS.LOCAL_ACCOUNT_WAIT_ENDED, {
                currency: wait.current.currency,
                outcome: outcomeOf(latest.current),
                wait_ms: Date.now() - wait.current.startedAt,
            })
            wait.current = null
        }
    }, [settling, currency])

    useEffect(
        () => () => {
            if (!wait.current) return
            posthog.capture(ANALYTICS_EVENTS.LOCAL_ACCOUNT_WAIT_ENDED, {
                currency: wait.current.currency,
                outcome: 'left' satisfies WaitOutcome,
                wait_ms: Date.now() - wait.current.startedAt,
            })
            wait.current = null
        },
        []
    )
}
