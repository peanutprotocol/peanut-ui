/**
 * Which sentence a failed claim gets, from the wire discriminant rather than
 * the backend's own words.
 *
 * The API answers in English in every locale, and that text used to be
 * rendered verbatim under a localized title. The code (and, where the refusal
 * carries none, the status) decides the sentence; the raw message stays for
 * Sentry and the analytics event.
 */
export type ClaimErrorKey = 'notAvailable' | 'accountLimit' | 'residenceRestricted' | 'refused' | 'generic'

const BY_CODE: Record<string, ClaimErrorKey> = {
    DEPOSIT_ACCOUNTS_NOT_AVAILABLE: 'notAvailable',
    DEPOSIT_ACCOUNT_LIMIT: 'accountLimit',
}

/**
 * The failures a retry alone may never clear, so the screen also offers a
 * person. `generic` is left out on purpose: a timeout or a 5xx is worth one
 * more tap before a support ticket.
 */
const OFFERS_SUPPORT: ReadonlySet<ClaimErrorKey> = new Set(['accountLimit', 'refused'])

export function claimErrorKey(code: string | undefined, status: number | undefined): ClaimErrorKey {
    const known = code ? BY_CODE[code] : undefined
    if (known) return known
    // The residence refusal is the one that sends no code: every Bridge money
    // route answers it as a bare 403 (`blockBridgeForRestrictedResidence`).
    if (status === 403) return 'residenceRestricted'
    // A 409 with no code is the claim route refusing, and it does not say which
    // kind: "another account is still being set up" clears by itself, "we could
    // not set up your account details — contact support" never does. The
    // sentence has to be true for both, so it says to try again and names
    // support for when that fails. "Try again in a moment" alone sent users
    // with a dead claim round the same button.
    if (status === 409) return 'refused'
    return 'generic'
}

export function claimErrorOffersSupport(key: ClaimErrorKey): boolean {
    return OFFERS_SUPPORT.has(key)
}
