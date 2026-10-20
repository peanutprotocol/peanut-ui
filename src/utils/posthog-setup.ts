import { APP_RELEASE } from '@/constants/app-release'
import { getPlatform } from '@/utils/capacitor'

/**
 * The PostHog project key baked into this build, or null when this build must
 * not send analytics.
 *
 * Each deployment chooses its project through its own `NEXT_PUBLIC_POSTHOG_KEY`:
 * Vercel scopes the value per environment (Production vs Preview, which also
 * serves staging), and the native lanes read it from their GitHub environment.
 * An empty value turns PostHog off for that build instead of initializing it
 * with no token.
 */
export function posthogProjectKey(): string | null {
    return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null
}

/**
 * Super properties registered in posthog.init's `loaded` callback, which runs
 * before the initial $pageview is captured. Anything registered later (the
 * async device context in locale-store) misses a visitor's first pageview,
 * because super properties are only persisted from that point on.
 */
export function initialSuperProperties(): Record<string, string> {
    return { app_release: APP_RELEASE, platform: getPlatform() }
}
