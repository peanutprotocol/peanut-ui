// Build-time harness gate. Next.js inlines `process.env.NEXT_PUBLIC_*` at
// compile time, so in prod builds this evaluates to `false` and every `if
// (HARNESS_ENABLED)` branch becomes dead code the bundler can drop. Harness
// imports do not ship to prod.
export const HARNESS_ENABLED = process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK === 'true'

/**
 * Does this browser get to skip the passkey capability check?
 *
 * The QA browser has no platform authenticator, so every capability probe says
 * "no passkeys here" and /setup walls the run behind the unsupported-browser
 * modal before a scenario reaches its first screen. The same two signals the
 * kernel client already trusts answer it: the build-time harness flag, and the
 * localStorage key the harness sets per session. Production has neither, so
 * this is `false` there and nothing about the real check changes.
 */
export function harnessPasskeyBypass(): boolean {
    if (typeof window === 'undefined') return false
    return HARNESS_ENABLED || window.localStorage?.getItem('__harness_skip_passkey') === 'true'
}
