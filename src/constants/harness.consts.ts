// Build-time harness gate. Next.js inlines `process.env.NEXT_PUBLIC_*` at
// compile time, so in prod builds this evaluates to `false` and every `if
// (HARNESS_ENABLED)` branch becomes dead code the bundler can drop. Harness
// imports do not ship to prod.
//
// The QA harness in mono (engineering/qa, through `uiSrc()`) imports this file
// in Node, so it must not import anything.
export const HARNESS_ENABLED = process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK === 'true'

/**
 * Browser storage keys the QA harness writes and the UI reads. The harness
 * imports these, so a rename here reaches every runner in one change.
 */
export const HARNESS_STORAGE_KEYS = {
    /** localStorage. 'true' skips the passkey wall; needs HARNESS_ENABLED too. */
    skipPasskey: '__harness_skip_passkey',
    /** localStorage. The private key the ECDSA kernel client signs with. */
    ecdsaPk: '__harness_ecdsa_pk',
    /** localStorage. 'false' makes the smart account pay its own gas. */
    ecdsaSponsored: '__harness_ecdsa_sponsored',
    /** sessionStorage. Action descriptors HarnessReplay runs after a reproduce reload. */
    replayActions: '__harness_replay_actions',
    /** sessionStorage. The next replay action, kept across navigations. */
    replayIndex: '__harness_replay_index',
} as const

/**
 * The localStorage entries that give a session the harness signer: passkey
 * bypass on, the ECDSA key, and the sponsorship mode. Every caller that starts
 * a harness session writes these values, in the UI and in the QA harness.
 */
export function harnessSignerStorage(privateKey: string, sponsored: boolean): Record<string, string> {
    return {
        [HARNESS_STORAGE_KEYS.skipPasskey]: 'true',
        [HARNESS_STORAGE_KEYS.ecdsaPk]: privateKey,
        [HARNESS_STORAGE_KEYS.ecdsaSponsored]: sponsored ? 'true' : 'false',
    }
}

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
    return HARNESS_ENABLED && window.localStorage?.getItem(HARNESS_STORAGE_KEYS.skipPasskey) === 'true'
}
