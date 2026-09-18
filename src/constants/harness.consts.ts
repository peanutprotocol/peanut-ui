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
 * modal before a scenario reaches its first screen. Two signals must BOTH hold
 * to skip it: the build-time harness flag, AND the localStorage key the harness
 * sets per session. The flag is compiled to `false` in prod builds, so a user
 * who sets the localStorage key on peanut.me still cannot bypass the passkey
 * wall — the flag gates the key, not the other way around.
 */
export function harnessPasskeyBypass(): boolean {
    if (typeof window === 'undefined') return false
    return HARNESS_ENABLED && window.localStorage?.getItem('__harness_skip_passkey') === 'true'
}
