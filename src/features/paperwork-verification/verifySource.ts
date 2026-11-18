/**
 * Where a person opened the verify screen from, for the verification funnel (TASK-25063): the `entry` property on
 * Verify start's events, then on every kyc_paperwork_* event and today's flow's KYC events until the check ends.
 * Session storage, never the URL: a link someone shares must not carry it.
 */
export type VerifySource = 'signup' | 'home' | 'unlock_payments' | 'guest_claim' | 'payment_methods' | 'card' | 'direct'

/** set by the caller just before it opens /verify; Verify start takes it when it shows */
const PENDING_KEY = 'peanut:verify-source-pending'
/** the source of the Verify start shown last in this tab: the funnel's entry */
const CURRENT_KEY = 'peanut:verify-source'

const read = (key: string) => {
    try {
        return window.sessionStorage.getItem(key) as VerifySource | null
    } catch {
        return null
    }
}
const write = (key: string, value: VerifySource | null) => {
    try {
        if (value) window.sessionStorage.setItem(key, value)
        else window.sessionStorage.removeItem(key)
    } catch {
        // private mode: the funnel loses its entry, the check goes on
    }
}

/** The caller that sends a person to /verify names itself first. */
export function markVerifySource(source: VerifySource) {
    write(PENDING_KEY, source)
}

/**
 * Verify start is showing: its source is the one given (today's check knows its caller), else the one a caller left
 * for /verify, else a direct visit. It becomes the funnel's entry.
 */
export function startVerifySource(given?: VerifySource): VerifySource {
    const source = given ?? read(PENDING_KEY) ?? 'direct'
    write(PENDING_KEY, null)
    write(CURRENT_KEY, source)
    return source
}

/** `{ entry }` for an event of the verification in progress, or nothing when no Verify start was shown. */
export function verifySourceProperty(): { entry?: VerifySource } {
    const entry = read(CURRENT_KEY)
    return entry ? { entry } : {}
}
