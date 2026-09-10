// Captures what the ZeroDev SDK throws away from /passkeys/{login,register}/verify:
// it performs the fetch internally and discards the response body. The body
// carries the session JWT for clients without a response cookie; on every platform
// it carries the step-up proof a login mints (so the card does not ask for a
// second sheet) and, for non-2xx, the server's reason. Wrapping window.fetch
// works with CapacitorHttp both on (bridge-patched fetch) and off.

import * as Sentry from '@/utils/sentry-lazy'
import { currentCeremonyId, stashCeremonyStepUpToken, stashCeremonyVerifyToken } from './passkeyCeremony.utils'

// ZeroDev swallows the status/body of these fetches, so a rejected ceremony
// reaches Sentry only as an opaque "Login not verified" (PEANUT-UI-R0X) with
// no hint of which server check failed. Attach that context as breadcrumbs;
// the ceremony caller owns the single exception report.
const PASSKEY_URL_PATTERN = /\/passkeys\/(login|register)\/(options|verify)/

function reportPasskeyHttpFailure(path: string, status: number, body: string): void {
    Sentry.addBreadcrumb({
        category: 'passkey.http',
        message: `passkey ${path} failed with status ${status}`,
        level: 'warning',
        data: { path, status, body: body.slice(0, 500) },
    })
}

function reportPasskeyFetchFailure(path: string, error: unknown): void {
    Sentry.addBreadcrumb({
        category: 'passkey.fetch',
        message: error instanceof Error ? error.message : String(error),
        level: 'warning',
        data: { path },
    })
}

let installed = false
let underlyingFetch: typeof fetch | null = null

/**
 * The window.fetch this wrapper found at install time (unbound, so identity
 * checks against CapacitorWebFetch still work). Lets the canary tell "fetch
 * was patched by the CapacitorHttp proxy" apart from "fetch was wrapped by us".
 */
export function getUnderlyingFetch(): typeof fetch | null {
    return underlyingFetch
}

export function installPasskeyVerifyCapture(): void {
    if (installed || typeof window === 'undefined') return
    installed = true

    underlyingFetch = window.fetch
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const passkeyPath = PASSKEY_URL_PATTERN.exec(url)?.[0] ?? null
        const isVerify = passkeyPath !== null && passkeyPath.endsWith('/verify')
        // Bind the request to the ceremony active at ISSUE time: a verify whose
        // request predates the current ceremony's window must not enter its stash.
        const issuingCeremonyId = isVerify ? currentCeremonyId() : null

        let response: Response
        try {
            response = await originalFetch(input, init)
        } catch (error) {
            if (passkeyPath) {
                try {
                    reportPasskeyFetchFailure(passkeyPath, error)
                } catch {}
            }
            throw error
        }

        // Surface the API conflict before the SDK tries to decode a missing
        // challenge/public key. Never retry by attaching to an existing user.
        if (response.status === 409 && passkeyPath?.startsWith('/passkeys/register/')) {
            const body = await response
                .clone()
                .json()
                .catch(() => null)
            if (body?.code === 'USERNAME_TAKEN') {
                const error = new Error(body.error)
                error.name = 'UsernameTaken'
                throw error
            }
        }

        try {
            if (passkeyPath && !response.ok) {
                const body = await response
                    .clone()
                    .text()
                    .catch(() => '')
                reportPasskeyHttpFailure(passkeyPath, response.status, body)
            }
            // The token is only STASHED here (keyed to the issuing ceremony);
            // guardPasskeyCeremony persists it when the owning ceremony resolves
            // and discards it on failure — so a verify landing after its
            // ceremony was reported "failed" can never leave a
            // half-authenticated session (TASK-21782).
            if (response.ok && isVerify) {
                const body = await response.clone().json()
                if (body && typeof body.token === 'string' && body.token) {
                    stashCeremonyVerifyToken(body.token, issuingCeremonyId)
                }
                if (body && typeof body.stepUpToken === 'string' && typeof body.stepUpExpiresIn === 'number') {
                    stashCeremonyStepUpToken(body.stepUpToken, body.stepUpExpiresIn, issuingCeremonyId)
                }
            }
        } catch {
            // capture is best-effort; never break the original request
        }
        return response
    }
}
