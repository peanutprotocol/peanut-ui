/**
 * True when the active kernel client's smart-account address doesn't belong to
 * the logged-in user — i.e. the session is paired with the wrong passkey, so
 * any signature it produces will be rejected (AA24 on-chain, or an invalid
 * ERC-1271 admin signature for Rain card withdraws).
 *
 * Returns false (treat as fine) when either address is missing: mid-registration
 * the user has no smart-wallet account yet, and pre-migration accounts inject
 * the address rather than derive it from the key — so an address comparison
 * can't detect a mismatch for them.
 */
export const isStaleClientForUser = (
    derivedAddress: string | undefined,
    expectedAddress: string | undefined
): boolean => {
    if (!derivedAddress || !expectedAddress) return false
    return derivedAddress.toLowerCase() !== expectedAddress.toLowerCase()
}
