'use client'

import { useEffect, useState } from 'react'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { fetchInviterSuggestions } from './inviter-suggestions'

/**
 * "Did you mean" names for a confirmed miss on `code`, behind the rollout gate `signup-rollout-inviter-suggestions`.
 * Read without nonProdBypass: staging and previews must not call a route that does not exist yet (TASK-24908).
 * Flag off: no request, no chips, no events.
 */
export function useInviterSuggestions(code: string, missConfirmed: boolean): string[] {
    const isFlagOn = useFeatureFlags()
    // read only after a confirmed miss: the gate matters nowhere else on the step
    const enabled = missConfirmed && isFlagOn('signup-rollout-inviter-suggestions')
    const { track } = useSignupControl()
    const [result, setResult] = useState<{ code: string; names: string[] }>({ code: '', names: [] })

    useEffect(() => {
        if (!enabled || !missConfirmed) return
        let current = true
        void fetchInviterSuggestions(code).then((names) => {
            if (!current) return
            setResult({ code, names })
            if (names.length) track('inviter_suggestion', 'open', String(names.length))
        })
        return () => {
            current = false
        }
    }, [enabled, missConfirmed, code, track])

    return enabled && missConfirmed && result.code === code ? result.names : []
}
