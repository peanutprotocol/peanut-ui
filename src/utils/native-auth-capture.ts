// Captures what the ZeroDev SDK throws away from /passkeys/{login,register}/verify:
// it performs the fetch internally and discards the response body. On native
// the body carries the session JWT for cookie-less clients; on every platform
// it carries the step-up proof a login mints (so the card does not ask for a
// second sheet) and, for non-2xx, the server's reason. Wrapping window.fetch
// works with CapacitorHttp both on (bridge-patched fetch) and off.

import * as Sentry from '@/utils/sentry-lazy'
import { isCapacitor } from './capacitor'
import { currentCeremonyId, stashCeremonyStepUpToken, stashCeremonyVerifyToken } from './passkeyCeremony.utils'

// ZeroDev swallows the status/body of these fetches, so a rejected ceremony
// reaches Sentry only as an opaque "Login not verified" (PEANUT-UI-R0X) with
// no hint of WHICH server check failed — report non-2xx responses here.
const PASSKEY_URL_PATTERN = /\/passkeys\/(login|register)\/(options|verify)/

function reportPasskeyHttpFailure(path: string, status: number, body: string): void {
    Sentry.withScope((scope) => {
        scope.setFingerprint(['passkey-http-failure', path, String(status)])
        scope.setTag('error_type', 'passkey_http_failure')
        Sentry.captureMessage(`passkey ${path} failed with status ${status}`, {
            level: 'warning',
            extra: { path, status, body: body.slice(0, 500) },
        })
    })
}

function reportPasskeyFetchFailure(path: string, error: unknown): void {
    Sentry.withScope((scope) => {
        scope.setFingerprint(['passkey-fetch-failure', path])
        scope.setTag('error_type', 'passkey_fetch_failure')
        Sentry.captureMessage(
            `passkey ${path} fetch rejected: ${error instanceof Error ? error.message : String(error)}`,
            { level: 'warning', extra: { path } }
        )
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
                if (isCapacitor() && body && typeof body.token === 'string' && body.token) {
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
