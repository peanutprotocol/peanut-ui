'use client'
import { useEffect, useMemo, useReducer } from 'react'
import posthog from 'posthog-js'
import { isFeatureFlagEnabled, type FeatureFlagOptions } from '@/utils/featureFlag.utils'

/**
 * Reactive read of PostHog feature flags. PostHog delivers flags async after
 * page load; this hook returns a NEW checker function identity on every
 * flag-load event, so downstream useMemo/useCallback that depend on the
 * checker recompute (a stable identity silently froze gated UI at
 * mount-time values — the 2026-07 chain-rollout review finding).
 */
export function useFeatureFlags(): (flagKey: string, options?: FeatureFlagOptions) => boolean {
    const [version, bump] = useReducer((n: number) => n + 1, 0)
    useEffect(() => {
        // returns an unsubscribe function
        return posthog.onFeatureFlags(() => bump())
    }, [])
    return useMemo(
        () => (flagKey: string, options?: FeatureFlagOptions) => isFeatureFlagEnabled(flagKey, options),
        // `version` IS the reactivity trigger: a new checker identity per flag-load event.
        [version]
    )
}
