import { apiFetch } from '@/utils/api-fetch'
import {
    clearSignupAttribution,
    hasPendingSignupAttribution,
    readSignupAttributionAsync,
    serializeSignupAttribution,
} from '@/utils/signup-attribution'

let attachInFlight: Promise<boolean> | null = null

/**
 * Deliver source evidence only after the API session exists. The server scopes
 * the write to that session's user and makes the finalization idempotent.
 * Keeping the context until a 2xx acknowledgement makes this safe to retry
 * on the next authenticated app start.
 */
export function attachSignupAttribution(): Promise<boolean> {
    if (!attachInFlight) {
        attachInFlight = doAttachSignupAttribution().finally(() => {
            attachInFlight = null
        })
    }
    return attachInFlight
}

async function doAttachSignupAttribution(): Promise<boolean> {
    if (!(await hasPendingSignupAttribution())) return false
    const context = await readSignupAttributionAsync()
    if (!context) return false

    const response = await apiFetch('/users/me/signup-attribution', {
        method: 'POST',
        body: JSON.stringify({ attribution: serializeSignupAttribution(context) }),
        redactTelemetry: true,
    })
    if (!response.ok) throw new Error(`signup attribution attach failed: ${response.status}`)

    // The API has acknowledged the evidence, including terminal outcomes such
    // as expiry or analytics opt-out. Only now may the device copy be removed.
    clearSignupAttribution()
    return true
}
