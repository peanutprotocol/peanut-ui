'use client'
import { useEffect, useState } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { PWA_SUNSET_FLAG } from '@/constants/migration.consts'

/**
 * Is the PWA-sunset migration live? Fails closed (false) until PostHog flags
 * load; re-renders when they do (see useFeatureFlags).
 *
 * Deliberately no `nonProdBypass`: it would force the sunset block on for all
 * of staging/previews once the cutover date passes, bricking QA of the
 * un-flagged state.
 *
 * Testing with the flag on:
 * - PostHog UI (project 138913): add a release condition on `pwa-sunset`
 *   matching your `email` at 100%.
 * - Locally / on a preview: run
 *   `posthog.featureFlags.overrideFeatureFlags({ 'pwa-sunset': true })`
 *   in the console (persists for the session).
 */
export function useMigrationFlag(): boolean {
    const isEnabled = useFeatureFlags()
    // hydration-safe: posthog serves CACHED flags synchronously for returning
    // visitors, so a render-time read would disagree with the flag-off SSR
    // HTML on prerendered surfaces (landing, setup) and hard-fail hydration.
    // false until mounted keeps server and first client render identical.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted && isEnabled(PWA_SUNSET_FLAG)
}
