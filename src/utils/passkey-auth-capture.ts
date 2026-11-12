// Captures what the ZeroDev SDK throws away from /passkeys/{login,register}/verify:
// it performs the fetch internally and discards the response body. The body
// carries the session JWT for clients without a response cookie; on every platform
// it carries the step-up proof a login mints (so the card does not ask for a
// second sheet) and, for non-2xx, the server's reason. Wrapping window.fetch
// works with CapacitorHttp both on (bridge-patched fetch) and off.

import * as Sentry from '@/utils/sentry-lazy'
import { currentCeremonyId, stashCeremonyStepUpToken, stashCeremonyVerifyToken } from './passkeyCeremony.utils'
import { currentAndroidPasskeyScope, registerScopeChallenge } from './android-passkey-scope'

// ZeroDev swallows the status/body of these fetches, so a rejected ceremony
// reaches Sentry only as an opaque "Login not verified" (PEANUT-UI-R0X) with
// no hint of which server check failed. Attach that context as breadcrumbs;
// the ceremony caller owns the single exception report.
const PASSKEY_URL_PATTERN = /\/passkeys\/(login|register)\/(options|verify)/

/**
 * The passkey sheet returned a credential, but the API rejected its assertion.
 *
 * ZeroDev otherwise reads the non-2xx JSON as a success body and crashes on
 * `verification.verified`, erasing the HTTP status and making a stale credential
 * indistinguishable from an application bug. Keeping this as a small typed
 * error lets the native login flow offer one fresh chooser without trusting or
 * exposing the server body.
 */
export class PasskeyVerifyRejectedError extends Error {
    readonly status: number

    constructor(status: number) {
        super('Passkey verification was rejected')
        this.name = 'PasskeyVerifyRejectedError'
        this.status = status
    }
}

export class PasskeyVerifyRetryableError extends Error {
    constructor(
        readonly status: number,
        readonly retryAt: number
    ) {
        super('Passkey verification temporarily unavailable')
        this.name = 'PasskeyVerifyRetryableError'
    }
}

let loginRetryError: PasskeyVerifyRetryableError | undefined
export const getLoginRetryError = () =>
    loginRetryError && Date.now() < loginRetryError.retryAt ? loginRetryError : undefined

function retryAt(response: Response): number {
    const header = response.headers?.get('Retry-After')?.trim()
    if (header) {
        const seconds = /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : NaN
        const deadline = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(header)
        if (Number.isSafeInteger(deadline)) return Math.max(Date.now() + 1000, deadline)
    }
    return Date.now() + 1000
}

/** The assertion verified, but the account it belongs to was deleted (soft-deleted). */
export class PasskeyAccountDeletedError extends Error {
    constructor() {
        super('Passkey account was deleted')
        this.name = 'PasskeyAccountDeletedError'
    }
}

/**
 * /login/options or /register/options answered non-2xx. ZeroDev would hand the
 * error body to @simplewebauthn, which crashes reading the missing challenge
 * with a browser-specific TypeError. No prompt was shown, so nothing is known
 * about the device's passkey.
 */
export class PasskeyOptionsFailedError extends Error {
    readonly status: number

    constructor(path: string, status: number) {
        super(`Passkey ${path} failed with status ${status}`)
        this.name = 'PasskeyOptionsFailedError'
        this.status = status
    }
}

function errorCodeOf(body: string): unknown {
    try {
        return (JSON.parse(body) as { error?: unknown } | null)?.error
    } catch {
        return undefined
    }
}

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
        // Same rule for Android scopes: the challenge belongs to the flow that asked for it.
        const issuingScope = passkeyPath?.endsWith('/options') ? currentAndroidPasskeyScope() : undefined

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

        let failure: Error | null = null
        try {
            if (passkeyPath && !response.ok) {
                const body = await response
                    .clone()
                    .text()
                    .catch(() => '')
                reportPasskeyHttpFailure(passkeyPath, response.status, body)
                // An assertion was produced, but it did not authenticate. On
                // native iOS this commonly means the user chose an old Peanut
                // credential from a device that holds several. Throw before
                // ZeroDev decodes the error body as `{ verification: ... }`;
                // the login recovery wrapper decides whether to re-prompt.
                if (passkeyPath === '/passkeys/login/verify' && (response.status === 400 || response.status === 401)) {
                    failure = new PasskeyVerifyRejectedError(response.status)
                } else if (
                    passkeyPath === '/passkeys/login/verify' &&
                    response.status === 403 &&
                    errorCodeOf(body) === 'ACCOUNT_DELETED'
                ) {
                    failure = new PasskeyAccountDeletedError()
                } else if (
                    passkeyPath === '/passkeys/login/verify' &&
                    (response.status === 429 || response.status >= 500)
                ) {
                    loginRetryError = new PasskeyVerifyRetryableError(response.status, retryAt(response))
                    failure = loginRetryError
                } else if (passkeyPath.endsWith('/options')) {
                    failure = new PasskeyOptionsFailedError(passkeyPath, response.status)
                }
            }
            if (response.ok && issuingScope) {
                const body = await response.clone().json()
                registerScopeChallenge(issuingScope, body?.challenge ?? body?.options?.challenge)
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
        if (failure) throw failure
        return response
    }
}
