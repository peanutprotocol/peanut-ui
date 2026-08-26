// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// NOTE: `NEXT_PUBLIC_SENTRY_DSN` must be scoped to All Environments on Vercel
// (or every env that builds an alias serving traffic — e.g. staging.peanut.me).
// Vercel does NOT auto-rebuild when env-var scope changes, so changing the
// scope without re-triggering a build leaves the DSN undefined in the cached
// bundle and Sentry silently disabled. Burned by this 2026-05-14.
//
// The init itself lives in src/utils/sentry-init.ts. Importing it here installs
// the pre-init error buffer on every page; the SDK is fetched when an app route
// mounts or when something throws, so the marketing site doesn't pay for it.
import '@/utils/sentry-init'
