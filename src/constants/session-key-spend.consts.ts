/*
 * Per-transaction ephemeral session key for the mixed spend path
 * (src/utils/ephemeralSpendKey.ts) — collapses the two passkey prompts
 * (Rain admin EIP-712 + UserOp) into one enable-signature tap.
 *
 * DARK BY DEFAULT, two gates (the HARNESS_ENABLED pattern):
 *   1. Build-time: NEXT_PUBLIC_SESSION_KEY_SPEND is inlined by Next.js, so in
 *      builds without it every branch is dead code the bundler drops — the
 *      ephemeral-key path does not ship at all.
 *   2. Runtime: localStorage '__session_key_spend' must be 'true' on the
 *      device, so a flagged build still spends via the passkey path unless a
 *      tester opts the specific device in.
 *
 * Rationale for the gates: the ephemeral key signs the Rain admin EIP-712 via
 * ERC-1271, whose validity depends on the permission being installed in the
 * same UserOp's validation phase — proven in the dev harness, but this stays
 * dark until that proof has run against production contracts.
 */
export const SESSION_KEY_SPEND_BUILD_ENABLED = process.env.NEXT_PUBLIC_SESSION_KEY_SPEND === 'true'

export function sessionKeySpendEnabled(): boolean {
    if (!SESSION_KEY_SPEND_BUILD_ENABLED) return false
    try {
        return typeof window !== 'undefined' && window.localStorage?.getItem('__session_key_spend') === 'true'
    } catch {
        return false
    }
}
