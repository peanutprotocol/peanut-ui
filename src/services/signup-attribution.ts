import { apiFetch } from '@/utils/api-fetch'
import {
    clearPendingSignupAttribution,
    clearSignupAttribution,
    hasPendingSignupAttribution,
    readSignupAttributionAsync,
    serializeSignupAttribution,
} from '@/utils/signup-attribution'

const attachInFlight = new Map<string, Promise<boolean>>()

/**
 * Deliver source evidence only after the API session exists. The server scopes
 * the write to that session's user and makes the finalization idempotent.
 * Keeping the context until a 2xx acknowledgement makes this safe to retry
 * on the next authenticated app start.
 */
export function attachSignupAttribution(userId: string): Promise<boolean> {
    const existing = attachInFlight.get(userId)
    if (existing) return existing
    const attempt = doAttachSignupAttribution(userId).finally(() => {
        if (attachInFlight.get(userId) === attempt) attachInFlight.delete(userId)
    })
    attachInFlight.set(userId, attempt)
    return attempt
}

async function doAttachSignupAttribution(userId: string): Promise<boolean> {
    if (!(await hasPendingSignupAttribution(userId))) return false
    const context = await readSignupAttributionAsync()
    if (!context) return false
    const serialized = serializeSignupAttribution(context)
    if (!serialized) {
        await clearSignupAttribution()
        return false
    }

    const response = await apiFetch('/users/me/signup-attribution', {
        method: 'POST',
        body: JSON.stringify({ attribution: serialized }),
        redactTelemetry: true,
    })
    if (!response.ok) throw new Error(`signup attribution attach failed: ${response.status}`)

    // The API has acknowledged the evidence, including terminal outcomes such
    // as expiry or analytics opt-out. Stop delivery retries, but retain the
    // bounded context until signup_completed emits the client-side join key.
    await clearPendingSignupAttribution(userId)
    return true
}
