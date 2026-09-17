/**
 * Which sentence a failed claim gets, from the wire discriminant rather than
 * the backend's own words.
 *
 * The API answers in English in every locale, and that text used to be
 * rendered verbatim under a localized title. The code (and, where the refusal
 * carries none, the status) decides the sentence; the raw message stays for
 * Sentry and the analytics event.
 */
export type ClaimErrorKey = 'notAvailable' | 'inFlight' | 'residenceRestricted' | 'generic'

const BY_CODE: Record<string, ClaimErrorKey> = {
    DEPOSIT_ACCOUNTS_NOT_AVAILABLE: 'notAvailable',
    DEPOSIT_IN_FLIGHT: 'inFlight',
}

export function claimErrorKey(code: string | undefined, status: number | undefined): ClaimErrorKey {
    const known = code ? BY_CODE[code] : undefined
    if (known) return known
    // The residence refusal is the one that sends no code: every Bridge money
    // route answers it as a bare 403 (`blockBridgeForRestrictedResidence`).
    if (status === 403) return 'residenceRestricted'
    return 'generic'
}
