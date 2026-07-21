// Captures the session JWT from passkey verify responses on native.
// The ZeroDev SDK performs the /passkeys/{login,register}/verify fetch
// internally and discards the response body, so the token the API ships for
// cookie-less clients would otherwise be lost. Wrapping window.fetch here
// works with CapacitorHttp both on (bridge-patched fetch) and off (plain
// WebView fetch), so the same JS runs on old and new binaries.

import { isCapacitor } from './capacitor'
import { setAuthToken } from './auth-token'

const VERIFY_URL_PATTERN = /\/passkeys\/(login|register)\/verify/

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

export function installNativeAuthCapture(): void {
    if (!isCapacitor() || installed || typeof window === 'undefined') return
    installed = true

    underlyingFetch = window.fetch
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const response = await originalFetch(input, init)
        try {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
            if (response.ok && VERIFY_URL_PATTERN.test(url)) {
                const body = await response.clone().json()
                if (body && typeof body.token === 'string' && body.token) {
                    setAuthToken(body.token)
                }
            }
        } catch {
            // capture is best-effort; never break the original request
        }
        return response
    }
}
