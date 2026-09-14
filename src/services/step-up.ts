/**
 * Step-up authentication client.
 *
 * Sensitive routes (card PAN/CVV, PIN, withdrawal, bank-account add) want more
 * than a week-old session cookie: they want proof the person is still holding
 * the device. This runs a WebAuthn assertion against the user's own passkey and
 * exchanges it for a short-lived proof token.
 *
 * The token is cached for its lifetime so a multi-step flow (approve → prepare)
 * costs one Face ID prompt, not one per request. A login mints one too
 * (primeStepUpToken via the verify-capture fetch wrapper), so opening the
 * card right after logging in costs no extra sheet.
 */

import { startAuthentication } from '@simplewebauthn/browser'
import { apiFetch } from '@/utils/api-fetch'
import { getNativeRpId, isCapacitor } from '@/utils/capacitor'
import { guardPasskeyCeremony, isCeremonyGuardError } from '@/utils/passkeyCeremony.utils'
import { classifyPasskeyError } from '@/utils/webauthn.utils'
import { withCeremonyPurpose } from '@/utils/webauthn-ceremony-telemetry'
import { clearCachedStepUpToken, getCachedStepUpToken, setCachedStepUpToken } from './step-up-cache'

export const STEP_UP_HEADER = 'x-step-up-token'

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
    clearCachedStepUpToken()
}

/**
 * Seeds the cache from a token minted alongside a login: a login assertion
 * seconds old is as fresh as a step-up one, so the card does not ask again.
 */
export function primeStepUpToken(token: string, expiresIn: number): void {
    setCachedStepUpToken(token, expiresIn)
}

export async function getStepUpToken(): Promise<string> {
    const primed = getCachedStepUpToken()
    if (primed) return primed

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

    // Same guard class as login (TASK-21782): a step-up racing the async shim
    // install on native runs the webview's raw WebAuthn, which silently never
    // settles. Gate on the shim and bound the ceremony; guard failures surface
    // as StepUpError so callers render the curated copy, not a raw timeout.
    let cred: Awaited<ReturnType<typeof startAuthentication>>
    try {
        cred = await withCeremonyPurpose('step_up', () => guardPasskeyCeremony(() => startAuthentication(options)))
    } catch (error) {
        if (isCeremonyGuardError(error)) throw new StepUpError(classifyPasskeyError(error).message)
        throw error
    }

    const verifyResponse = await apiFetch('/auth/step-up/verify', {
        method: 'POST',
        body: JSON.stringify({ cred, rpID }),
    })
    if (!verifyResponse.ok) {
        throw new StepUpError('Could not confirm it is you.')
    }

    const { token, expiresIn } = (await verifyResponse.json()) as { token: string; expiresIn: number }
    setCachedStepUpToken(token, expiresIn)
    return token
}

/** Adds the proof header, acquiring one if needed. */
export async function withStepUpHeader(headers: Record<string, string>): Promise<Record<string, string>> {
    return { ...headers, [STEP_UP_HEADER]: await getStepUpToken() }
}
