import posthog from 'posthog-js'

// The last person properties sent, as `<userId>:<json>`. Persisted because
// posthog-js only remembers its own last $set in memory, so every app open
// (and every user refetch with a changed field) used to send a fresh $set.
const SENT_PERSON_PROPERTIES_KEY = 'posthog-person-properties-sent'

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
    const sent = `${userId}:${JSON.stringify(properties)}`
    if (posthog.get_distinct_id() !== userId) {
        posthog.identify(userId, properties)
    } else if (readSent() !== sent) {
        posthog.setPersonProperties(properties)
    } else {
        return
    }
    writeSent(sent)
}
