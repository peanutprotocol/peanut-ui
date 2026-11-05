import { APP_RELEASE } from '@/constants/app-release'
import { getPlatform } from '@/utils/capacitor'
import { inferSentryEnvironment } from '@/utils/sentry-env'

/**
 * The PostHog project key baked into this build, or null when it has none. A
 * build with no key skips PostHog instead of initializing it with no token.
 */
export function posthogProjectKey(): string | null {
    return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null
}

/**
 * Whether this build sends analytics. Only production does: staging, Vercel
 * previews, the Staging-OTA native build and local builds load PostHog with
 * capture opted out, so they keep the production key for feature flags and
 * send no event, pageview, replay or identify (Hugo, 2026-10-20).
 *
 * Web builds use the Sentry environment (Vercel production vs preview/staging).
 * Both native lanes report `native`; the Staging-OTA lane bakes the staging
 * site URL. Read from env rather than BASE_URL (same default) because
 * general.consts pulls viem chains into the earliest client bundle.
 */
export function isAnalyticsCaptureBuild(): boolean {
    const environment = inferSentryEnvironment()
    if (environment === 'production') return true
    return environment === 'native' && (process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me') === 'https://peanut.me'
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
