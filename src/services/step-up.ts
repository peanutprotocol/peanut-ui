/**
 * Step-up authentication client.
 *
 * Sensitive routes (card PAN/CVV, PIN, withdrawal, bank-account add) want more
 * than a week-old session cookie: they want proof the person is still holding
 * the device. This runs a WebAuthn assertion against the user's own passkey and
 * exchanges it for a short-lived proof token.
 *
 * The token is cached for its lifetime so a multi-step flow (approve → prepare)
 * costs one Face ID prompt, not one per request.
 */

import { startAuthentication } from '@simplewebauthn/browser'
import { apiFetch } from '@/utils/api-fetch'
import { getNativeRpId, isCapacitor } from '@/utils/capacitor'

export const STEP_UP_HEADER = 'x-step-up-token'

/** Retire the token early so a request never leaves with one about to expire. */
const EXPIRY_MARGIN_MS = 30_000

let cached: { token: string; expiresAt: number } | null = null

export class StepUpError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'StepUpError'
    }
}

function currentRpId(): string {
    return isCapacitor() ? getNativeRpId() : window.location.hostname.replace(/^www\./, '')
}

/** Drops the cached proof. Call on logout, or after a 401 from a gated route. */
export function clearStepUpToken(): void {
    cached = null
}

export async function getStepUpToken(): Promise<string> {
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token
    cached = null

    const rpID = currentRpId()

    const optionsResponse = await apiFetch('/auth/step-up/options', {
        method: 'POST',
        body: JSON.stringify({ rpID }),
    })
    if (!optionsResponse.ok) {
        throw new StepUpError(
            optionsResponse.status === 404
                ? 'No passkey is registered for this account.'
                : 'Could not start verification.'
        )
    }
    const options = await optionsResponse.json()

    const cred = await startAuthentication(options)

    const verifyResponse = await apiFetch('/auth/step-up/verify', {
        method: 'POST',
        body: JSON.stringify({ cred, rpID }),
    })
    if (!verifyResponse.ok) {
        throw new StepUpError('Could not confirm it is you.')
    }

    const { token, expiresIn } = (await verifyResponse.json()) as { token: string; expiresIn: number }
    cached = { token, expiresAt: Date.now() + expiresIn * 1000 }
    return token
}

/** Adds the proof header, acquiring one if needed. */
export async function withStepUpHeader(headers: Record<string, string>): Promise<Record<string, string>> {
    return { ...headers, [STEP_UP_HEADER]: await getStepUpToken() }
}
