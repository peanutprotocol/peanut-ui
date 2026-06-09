/**
 * True when the active kernel client's smart-account address doesn't belong to
 * the logged-in user — i.e. the session is paired with the wrong passkey, so
 * any signature it produces will be rejected (AA24 on-chain, or an invalid
 * ERC-1271 admin signature for Rain card withdraws).
 *
 * Returns false (treat as fine) when either address is missing: mid-registration
 * the user has no smart-wallet account yet, and the comparison only makes sense
 * when we have both a derived and an expected address.
 */
export const isStaleClientForUser = (
    derivedAddress: string | undefined,
    expectedAddress: string | undefined
): boolean => {
    if (!derivedAddress || !expectedAddress) return false
    return derivedAddress.toLowerCase() !== expectedAddress.toLowerCase()
}

/**
 * Recognises a stale-credential failure: either one we threw ourselves (tagged
 * `isStaleKeyError`) or the on-chain/bundler symptoms of signing with the wrong
 * passkey — AA24 (EntryPoint signature check failed) or ZeroDev's `wapk
 * unauthorized` (WebAuthn key not authorised; deliberately paired with
 * "unauthorized" so a generic 401 doesn't match).
 */
export const isStaleKeyError = (error: unknown): boolean => {
    if (error && typeof error === 'object' && (error as { isStaleKeyError?: unknown }).isStaleKeyError === true) {
        return true
    }
    const errorStr = String(error).toLowerCase()
    return errorStr.includes('aa24') || (errorStr.includes('wapk') && errorStr.includes('unauthorized'))
}

/**
 * Builds the user-facing stale-session error. Tagged with `isStaleKeyError` so
 * downstream handlers can detect it and force a clean re-auth.
 */
export const createStaleSessionError = (cause?: unknown): Error => {
    const error = new Error('Your session has expired. Please log in again.') as Error & {
        isStaleKeyError: boolean
        cause?: unknown
    }
    error.isStaleKeyError = true
    if (cause !== undefined) error.cause = cause
    return error
}
