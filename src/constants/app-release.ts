/**
 * The JS bundle's commit — the exact value Sentry sends as `release`, so a
 * Sentry failure count and a PostHog open count for the same build join on one
 * key. With OTA updates this can differ from the installed binary, which
 * Sentry tags separately as `binaryVersion`.
 *
 * Deliberately import-free: instrumentation-client registers this before
 * PostHog's initial $pageview, and must not drag a dependency chain into the
 * earliest client bundle.
 */
export const APP_RELEASE = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH ?? 'unknown'
