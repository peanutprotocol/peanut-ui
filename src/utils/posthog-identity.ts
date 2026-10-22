import posthog from 'posthog-js'

// A hash of the last user id and person properties sent. Persisted because
// posthog-js only remembers its own last $set in memory, so every app open
// used to send a fresh $set. Only the hash is stored: the properties are a
// profile (username, KYC status, rails), and the next user of the browser
// must not read them. Cleared on logout.
const SENT_PERSON_PROPERTIES_KEY = 'posthog-person-properties-sent'

/** FNV-1a: a comparison fingerprint, not a security boundary. */
function fingerprint(value: string): string {
    let hash = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(36)
}

function readSent(): string | null {
    try {
        return localStorage.getItem(SENT_PERSON_PROPERTIES_KEY)
    } catch {
        return null
    }
}

function writeSent(value: string): void {
    try {
        localStorage.setItem(SENT_PERSON_PROPERTIES_KEY, value)
    } catch {}
}

/**
 * Identifies the signed-in user in PostHog without re-sending what PostHog
 * already has.
 *
 * `identify` runs only when the PostHog distinct id is not this user yet (the
 * first login on a device, or the next login after a logout reset). For a user
 * who is already identified, person properties go out as one `$set` only when
 * they differ from the last ones sent from this device.
 */
export function identifyAnalyticsUser(userId: string, properties: Record<string, unknown>): void {
    const sent = fingerprint(`${userId}:${JSON.stringify(properties)}`)
    if (posthog.get_distinct_id() !== userId) {
        posthog.identify(userId, properties)
    } else if (readSent() !== sent) {
        posthog.setPersonProperties(properties)
    } else {
        return
    }
    writeSent(sent)
}

/** Forget what was sent for the signed-in user. Call on logout, next to posthog.reset(). */
export function clearAnalyticsIdentity(): void {
    try {
        localStorage.removeItem(SENT_PERSON_PROPERTIES_KEY)
    } catch {}
}
