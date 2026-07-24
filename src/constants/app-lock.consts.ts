// Master switch for the native app-OPEN lock.
//
// Off by default: opening the app and viewing the balance is NOT gated behind a
// local presence check, matching the web app where the same read-only view is
// ungated. We treat "someone opens the app and sees a balance" as non-critical;
// the controls that matter — moving money — stay passkey-gated at the
// transaction layer, independently of this flag.
//
// The lock component (AppLock) stays fully in the codebase but is dormant when
// this is false: it never engages on cold start or on background resume.
//
// Set NEXT_PUBLIC_APP_OPEN_GATED=true to re-engage it. Next.js inlines
// `process.env.NEXT_PUBLIC_*` at compile time, so a default build keeps the gate
// off.
export const OPEN_GATED = process.env.NEXT_PUBLIC_APP_OPEN_GATED === 'true'
