'use client'
import { useEffect, useState } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { isPwaSunsetOn } from '@/utils/migration.utils'

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
 * - On a preview/prod build: run
 *   `posthog.featureFlags.overrideFeatureFlags({ flags: { 'pwa-sunset': true } })`
 *   in the console (persists for the session; posthog-js >=1.3xx requires the
 *   `flags` wrapper — a flat object is silently ignored). Clear with
 *   `overrideFeatureFlags(false)`.
 * - Local dev (posthog never inits): `localStorage.setItem('pwa-sunset', 'true')`
 *   + reload; cutover via `localStorage.setItem('pwa-sunset-cutover', '2020-01-01')`.
 *   See isPwaSunsetOn / getMigrationCutoverTime.
 */
export function useMigrationFlag(): boolean {
    // subscribe to posthog flag-load events so consumers re-render when flags
    // arrive; the actual read goes through isPwaSunsetOn (dev override aware)
    useFeatureFlags()
    // hydration-safe: posthog serves CACHED flags synchronously for returning
    // visitors, so a render-time read would disagree with the flag-off SSR
    // HTML on prerendered surfaces (landing, setup) and hard-fail hydration.
    // false until mounted keeps server and first client render identical.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted && isPwaSunsetOn()
}
