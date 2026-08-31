import type { SeverityLevel } from '@sentry/nextjs'
import * as Sentry from '@/utils/sentry-lazy'

import { type JSONValue } from '../interfaces/interfaces'
import { reportNetworkError } from './connectivity'
import { canUseNativeHttp, nativeHttpRequest } from './native-http'

/**
 * Endpoint + status combinations to skip reporting.
 * These are expected responses, not errors.
 * Pattern can be a string (exact match) or regex.
 */
const SKIP_REPORTING: Array<{ pattern: string | RegExp; statuses: number[] }> = [
    // /get-user is the auth-status probe — 401/404 mean stale JWT, expected, not a server bug.
    { pattern: /\/get-user(?:\b|$)/, statuses: [400, 401, 403, 404] },
    { pattern: /users/, statuses: [400, 401, 403, 404] },
    { pattern: /perks/, statuses: [400, 401, 403, 404] },
    // /invites/validate 400 = "Invalid Invite": the user mistyped an invite code.
    // Expected input validation, surfaced inline to the user — not a server bug.
    { pattern: /\/invites\/validate/, statuses: [400] },
    // /tokens/price 404 means the upstream price provider declined the lookup —
    // in practice a Mobula 429. The UI falls back to token denomination, so it is
    // a degraded display, never a wrong number. The backend already downgraded
    // its own log to warn for this exact reason (PEANUT-API-75); reporting it
    // from the client re-created the same page-per-lookup noise as PEANUT-UI-QKY.
    { pattern: /\/tokens\/price\/?(?:[?#]|$)/, statuses: [404] },
    // Public FX pair misses and validation failures are expected user/input
    // outcomes, not backend incidents. 503 is included deliberately: it means a
    // provider leg is momentarily absent, which peanut-api already reports with
    // the upstream cause attached. Reporting it here too would multiply one
    // incident by every mounted hook and its retries — the merchant page alone
    // runs three — and bury the backend signal that can actually be acted on.
    { pattern: /\/fx\/rate(?:\?|$)/, statuses: [400, 404, 429, 503] },
    // qr-payment/init: 400 = open QR awaiting merchant amount; 422 = a QR the
    // provider can't decode (bad/expired/unsupported) — both are user-input
    // outcomes shown to the user, not server bugs. (BE peanut-api-ts #1041.)
    { pattern: /qr-payment\/init/, statuses: [400, 422] },
    // Rain card secrets endpoints are intentionally rate-limited (5/min) — a
    // 429 here is an expected outcome surfaced to the user, not a server bug.
    { pattern: /\/rain\/cards\/[^/]+\/details/, statuses: [429] },
    { pattern: /\/rain\/cards\/[^/]+\/pin/, statuses: [429] },
    // /withdraw/prepare 425 is Rain's withdrawal-signature cooldown — surfaced
    // to the user via the cooldown modal + floating timer. Normal UX state,
    // not an error; would otherwise flood Sentry on every retry.
    { pattern: /\/rain\/cards\/withdraw\/prepare/, statuses: [425] },
    // /send-links/{pubKey} 404 = link not yet indexed (DB replication lag) or a
    // mistyped/withdrawn link — both expected, surfaced by the polling/claim UI.
    // The claim-success poller hits this every second until the claim lands.
    { pattern: /\/send-links\/0x[0-9a-fA-F]{40}/, statuses: [404] },
]

/**
 * URLs whose request OR response body carries sensitive data wholesale.
 * For these, the body is replaced with '[REDACTED]' before being attached
 * to Sentry — covers card secrets, KYC submissions, send-link passwords,
 * auth credentials.
 */
const BODY_SENSITIVE_URLS: RegExp[] = [
    // Card secrets — PIN, CVV, details
    /\/rain\/cards\/[^/]+\/(?:pin|cvv|details)(?:[/?]|$)/,
    // Card creation/update — Rain backend, holder PII
    /\/rain\/cards(?:\?|$)/,
    /\/rain\/cardholders/,
    // Send-link passwords
    /\/send-link\/(?:create|verify-password|claim|set-password)/,
    /\/verify-password/,
    // Auth — login, signup, password set/reset
    /\/(?:login|signup|register|set-password|reset-password|change-password)/,
    // KYC — Bridge, Sumsub, Manteca
    /\/kyc\/(?:start|submit|update)/,
    /\/bridge\/customers/,
    /\/manteca\/(?:user|widgets)/,
    /\/sumsub\/(?:applicant|token)/,
]

/**
 * Lowercased + underscore/hyphen-stripped field names whose values should
 * be redacted recursively. Identity fields (userId, username, email,
 * inviteCode) are intentionally NOT in this set — they're already in
 * PostHog and Hugo wants them queryable in Sentry too.
 *
 * IMPORTANT: this is an EXACT-MATCH set. We deliberately do NOT
 * substring-match because Peanut has first-class onchain addresses
 * everywhere — `walletAddress`, `recipientAddress`, `tokenAddress`,
 * `sdaAddress`, `depositAddress`, `destinationAddress`, `payerAddress`.
 * Those are public chain data that MUST stay visible for debugging
 * onchain flows. Substring-matching on `address` would clobber every
 * one of them. Same for `pin`, `token`, `seed` — share names with
 * non-sensitive concepts.
 */
const SENSITIVE_KEYS = new Set([
    // Passwords + secrets
    'password',
    'pwd',
    'passphrase',
    'secret',
    'secretkey',
    'apikey',
    'apitoken',
    'bearer',
    'authtoken',
    'jwt',
    'token',
    'sessiontoken',
    'refreshtoken',
    'accesstoken',
    'idtoken',
    'privatekey',
    'mnemonic',
    'seed',
    'seedphrase',
    'recoveryphrase',
    // Card data
    'pan',
    'cardnumber',
    'cvv',
    'cvc',
    'securitycode',
    'cardpin',
    'pin',
    'cardholdername',
    'expirydate',
    'expirymonth',
    'expiryyear',
    'expmonth',
    'expyear',
    // Government IDs (English + Bridge long-form)
    'ssn',
    'socialsecurity',
    'socialsecuritynumber',
    'taxid',
    'taxidentificationnumber',
    'tin',
    'dni',
    'cuit',
    'cuil',
    'rfc',
    'curp',
    'nif',
    'governmentid',
    'governmentidnumber',
    'documentnumber',
    'passport',
    'passportnumber',
    'driverslicense',
    'licensenumber',
    'idnumber',
    'nationalid',
    'nationalidnumber',
    // Manteca (Spanish)
    'documento',
    'numerodocumento',
    'numerodedocumento',
    // Bank account numbers
    'iban',
    'swift',
    'bic',
    'sortcode',
    'routingnumber',
    'accountnumber',
    'bankaccountnumber',
    'cbu',
    'cvu',
    'clabe',
    // PII — names (English + Manteca Spanish)
    'firstname',
    'lastname',
    'fullname',
    'givenname',
    'familyname',
    'surname',
    'middlename',
    'mothername',
    'mothersmaidenname',
    'maidenname',
    'customerfirstname',
    'customerlastname',
    'nombre',
    'apellido',
    // PII — address. NOTE: `address` alone is NOT here — onchain addresses
    // (walletAddress, recipientAddress, etc.) must stay visible for
    // debugging onchain flows.
    'streetaddress',
    'street1',
    'street2',
    'street3',
    'streetline1',
    'streetline2',
    'streetline3',
    'addressline1',
    'addressline2',
    'addressline3',
    'billingaddress',
    'homeaddress',
    'mailingaddress',
    'residentialaddress',
    'permanentaddress',
    'direccion',
    'domicilio',
    'postalcode',
    'zipcode',
    'zip',
    'postcode',
    // PII — DOB / contact
    'dob',
    'dateofbirth',
    'birthdate',
    'birthday',
    'phonenumber',
    'mobilenumber',
    'telephone',
    'telefono',
    // 2FA / OTP
    'otp',
    'verificationcode',
    'totpsecret',
    'twofactor',
    'twofactorsecret',
])

function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[_-]/g, '')
}

function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.has(normalizeKey(key))
}

function isSensitiveUrl(url: string | undefined): boolean {
    if (!url) return false
    return BODY_SENSITIVE_URLS.some((pattern) => pattern.test(url))
}

/**
 * Recursively redacts sensitive keys in any object — applied to both
 * request bodies AND response bodies before they ship to Sentry.
 */
export function scrubObject(value: unknown, depth = 0): unknown {
    if (depth > 10) return '[REDACTED: max depth]'
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((item) => scrubObject(item, depth + 1))
    // Prototype-pollution defense — two layers, both required:
    //   1. `Object.create(null)` so `out` has no prototype to pollute.
    //   2. `Object.defineProperty` with explicit descriptor instead of
    //      `out[key] = …`. The former is recognised by CodeQL's taint
    //      analysis as a sanitizer; the latter triggers
    //      js/prototype-polluting-assignment even when keys are validated
    //      because CodeQL can't prove the runtime check is complete.
    //   3. Explicit skip of __proto__ / constructor / prototype — belt
    //      and braces; redundant with (1) but documents intent.
    const out: Record<string, unknown> = Object.create(null)
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
        Object.defineProperty(out, key, {
            value: isSensitiveKey(key) ? '[REDACTED]' : scrubObject(val, depth + 1),
            writable: true,
            enumerable: true,
            configurable: true,
        })
    }
    return out
}

export const sanitizeRequestBody = (url: string, body: BodyInit | null | undefined): BodyInit | string | null => {
    if (body == null) return null
    if (isSensitiveUrl(url)) return '[REDACTED: sensitive endpoint]'
    // String bodies — try JSON parse, scrub, re-stringify; otherwise pass through.
    if (typeof body === 'string') {
        try {
            return JSON.stringify(scrubObject(JSON.parse(body)))
        } catch {
            return body
        }
    }
    return body
}

/**
 * Sanitize response bodies before they land in Sentry `extra`. Same
 * URL + key-scrubbing as request bodies.
 */
export const sanitizeResponseBody = (url: string, body: unknown): unknown => {
    if (isSensitiveUrl(url)) return '[REDACTED: sensitive endpoint]'
    return scrubObject(body)
}

/**
 * Map URL → feature tag so Sentry issues can be filtered by product surface
 * without wrapping every call site. Add new entries here as features grow.
 */
const FEATURE_TAGS: Array<{ pattern: RegExp; tag: string }> = [{ pattern: /\/rain\//, tag: 'card' }]

function getFeatureTag(url: string): string | null {
    for (const rule of FEATURE_TAGS) {
        if (rule.pattern.test(url)) return rule.tag
    }
    return null
}

/**
 * Check if this endpoint + status combo should skip Sentry reporting
 */
function shouldSkipReporting(url: string, status: number): boolean {
    for (const rule of SKIP_REPORTING) {
        const matches = typeof rule.pattern === 'string' ? url.includes(rule.pattern) : rule.pattern.test(url)

        if (matches && rule.statuses.includes(status)) {
            return true
        }
    }
    return false
}

/**
 * Server-side budget — deliberately UNCHANGED at the historical 10s.
 *
 * A server fetch runs inside a Vercel function, so it must abort before the
 * platform kills the function, otherwise we leak an opaque 504 instead of
 * owning the error. The old comment here put that ceiling at 15s; today
 * `vercel.json` says `maxDuration: 300` — but that entry declares the glob
 * `app/api/**` while this project keeps its routes under `src/app/api/`, and
 * Vercel requires the `src/` prefix for src-directory projects, so the entry
 * currently matches nothing. The real ceiling is therefore the project default
 * (300s with Fluid compute, far lower without), which cannot be read from the
 * repo.
 *
 * Raising this buys little — a Vercel→api.peanut.me call is a datacenter hop,
 * not a mobile network — and risks sitting ABOVE an unverified ceiling, which
 * would reintroduce exactly the 504s the original 10s existed to prevent. So it
 * stays put until the ceiling is confirmed. See the PR for the follow-up.
 */
export const SERVER_FETCH_TIMEOUT_MS = 10_000

/**
 * Client-side budget — the actual fix. No platform ceiling applies in a
 * browser, only real mobile networks, and 10s sat below the page load itself in
 * high-latency markets (Nigeria p90 LCP 11.3s vs 6.1s globally), aborting
 * healthy requests and reporting them as failures. React Query retries and the
 * one idempotent transport retry multiply it; the worst-case total for the
 * default retry strategy is pinned in `sentry.utils.test.ts`.
 */
export const CLIENT_FETCH_TIMEOUT_MS = 20_000
export const TRANSPORT_TIMEOUT_RETRY_DELAY_MS = 300

/**
 * `NEXT_PUBLIC_FETCH_TIMEOUT_MS` is an explicit override of both budgets. It
 * must be a positive integer of milliseconds within the 32-bit timer range:
 * `parseInt` would have accepted `"30s"` as 30 and `"0"` as 0, and anything
 * above 2^31-1 overflows setTimeout and clamps to ~1ms — every one of which
 * aborts requests instantly. Malformed values fall back to the default rather
 * than bricking fetches. Both inputs are parameters so the function stays pure:
 * jsdom always defines `window`, so the server branch is otherwise unreachable
 * from tests.
 */
const MAX_TIMER_MS = 2_147_483_647

export const resolveDefaultTimeoutMs = (
    isServer: boolean,
    override: string | undefined = process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS
): number => {
    const parsed = Number(override)
    if (override && Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_TIMER_MS) return parsed
    return isServer ? SERVER_FETCH_TIMEOUT_MS : CLIENT_FETCH_TIMEOUT_MS
}

const DEFAULT_TIMEOUT_MS = resolveDefaultTimeoutMs(typeof window === 'undefined')

const getErrorLevelFromStatus = (status: number): SeverityLevel => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'info'
}

const sanitizeHeaders = (headers: RequestInit['headers']): Record<string, unknown> | undefined => {
    if (!headers) return undefined

    const sanitized: Record<string, unknown> = { ...headers }
    const sensitiveHeaders = [
        'authorization',
        'cookie',
        'set-cookie',
        'x-auth-token',
        'api-key',
        'x-api-key',
        'apikey',
        'md-api-key', // Manteca
        'x-app-token', // Sumsub
        'x-app-access-sig',
        'x-app-access-ts',
    ]

    for (const key of Object.keys(sanitized)) {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]'
        }
    }

    return sanitized
}

// Sanitize URL for fingerprinting by replacing IDs with placeholders
export const sanitizeUrl = (url: string) => {
    return (
        url
            // Replace numeric IDs in path
            .replace(/\/\d+(?=\/|$)/g, '/{id}')
            // Replace UUIDs in path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{uuid}')
            // Replace numeric IDs in query params. Anchored to the end of the
            // value: unanchored, this ate the leading 0 of an 0x-prefixed
            // address and left `{id}xaf88d065`, so every wallet still got its
            // own fingerprint AND the value was unreadable.
            .replace(/([?&][^=&]*=)\d+(?=&|$)/g, '$1{id}')
            /*
             * Then every remaining query value. Normalizing only the numeric ones
             * left each enum value of a param as its own Sentry issue: one 429 on
             * /bridge/exchange-rate was three issues (accountType=iban / clabe / gb,
             * PEANUT-UI-SGN / SQ4 / SSA) for a single upstream fault. The param
             * names still separate genuinely different calls, and the raw URL stays
             * on the event as `extra.url`.
             *
             * The lookahead skips values the numeric pass already replaced, so
             * fingerprints that were correct before this change keep grouping into
             * their existing issue instead of forking a new one.
             */
            .replace(/([?&][^=&]*=)(?!\{id\})[^&]*/g, '$1{value}')
    )
}

const reportNonOkResponse = async (url: string, options: RequestInit, response: Response): Promise<void> => {
    if (response.ok) return
    // Skip both the console warn AND Sentry submission for expected
    // non-2xx responses (username availability 404, get-user-from-cookie
    // 401 on cleared session, etc). Logging them clutters DevTools and
    // gets picked up by forward-logs-shared as Sentry breadcrumbs.
    if (shouldSkipReporting(url, response.status)) return

    // console.info, not warn — captureConsoleIntegration listens on
    // ['error','warn'], so a warn here became a SECOND Sentry event for every
    // non-2xx in the app, grouped by this call site rather than by request.
    // The explicit captureMessage below is the real report: it fingerprints on
    // [method, url, status] and carries headers, body and response.
    console.info(`Request to ${String(url).replace(/[\r\n]/g, '')} failed with status ${response.status}`)

    let errorContent: JSONValue
    try {
        errorContent = await response.clone().json()
    } catch {
        errorContent = await response.clone().text()
    }
    const method = options.method || 'GET'
    const featureTag = getFeatureTag(url)
    Sentry.withScope((scope) => {
        // Set fingerprint to group similar errors
        scope.setFingerprint([method, sanitizeUrl(url), String(response.status)])
        if (featureTag) scope.setTag('feature', featureTag)

        Sentry.captureMessage(`${method} to ${url} failed with status ${response.status}`, {
            level: getErrorLevelFromStatus(response.status),
            extra: {
                url,
                method,
                requestHeaders: sanitizeHeaders(options.headers || {}),
                requestBody: sanitizeRequestBody(url, options.body),
                status: response.status,
                response: sanitizeResponseBody(url, errorContent),
            },
        })
    })
}

export type FetchWithSentryOptions = RequestInit & { preferNativeTransport?: boolean }

export const fetchWithSentry = async (
    url: string,
    optionsWithTransport: FetchWithSentryOptions = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
    const { preferNativeTransport, ...options } = optionsWithTransport

    /*
     * Tokenless native sessions go over the OS HTTP client FIRST, not as a
     * rescue: legacy cookie-jar sessions hold the JWT only in the OS-level
     * cookie store, which rides on CapacitorHttp requests but is invisible to
     * JS (Android's CapacitorCookies.getCookies evals document.cookie and
     * ignores its url param). A WebView POST reaches the backend with neither
     * header nor cookie and 400s — and because it gets an HTTP response, the
     * rejection fallback below never engages. On OS-client failure, fall
     * through to the WebView path so logged-out flows behave as before.
     */
    if (preferNativeTransport && canUseNativeHttp(url, options)) {
        try {
            const response = await nativeHttpRequest(url, options, timeoutMs)
            await reportNonOkResponse(url, options, response)
            return response
        } catch {
            // OS client failed — the WebView path below is the report of record
        }
    }

    // Idempotent requests get one silent retry on timeout: stalled-transport
    // failures (Android webview, flaky mobile networks) usually clear on a
    // fresh attempt (PEANUT-UI-R44).
    const method = (options.method || 'GET').toUpperCase()
    const maxAttempts = method === 'GET' || method === 'HEAD' ? 2 : 1

    const attemptFetch = async (): Promise<Response> => {
        for (let attempt = 1; ; attempt++) {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
            try {
                return await fetch(url, {
                    ...options,
                    signal: controller.signal,
                })
            } catch (error) {
                if (attempt < maxAttempts && error instanceof Error && error.name === 'AbortError') {
                    console.warn(`Request to ${String(url).replace(/[\r\n]/g, '')} timed out — retrying`)
                    await new Promise((resolve) => setTimeout(resolve, TRANSPORT_TIMEOUT_RETRY_DELAY_MS))
                    continue
                }
                throw error
            } finally {
                clearTimeout(timeoutId)
            }
        }
    }

    try {
        const response = await attemptFetch()

        await reportNonOkResponse(url, options, response)

        return response
    } catch (error: unknown) {
        // WebView fetch rejected. On native, retry once over the OS HTTP client
        // before declaring failure: the edge rejects Android WebView requests at
        // the TLS-fingerprint level (PEANUT-UI-R5F), which fetch can only
        // surface as an opaque TypeError.
        if (canUseNativeHttp(url, options)) {
            try {
                const response = await nativeHttpRequest(url, options, timeoutMs)
                await reportNonOkResponse(url, options, response)
                return response
            } catch {
                // fallback failed too — report the original WebView error below
            }
        }

        // fetch rejected (timeout / DNS / connection refused) — the request never
        // completed, so flag a connectivity failure. keyed by sanitized url so
        // React Query retries of one slow route dedupe to a single endpoint.
        reportNetworkError(sanitizeUrl(url))
        // console.info, not error: captureConsoleIntegration would turn an
        // error-level log into a second Sentry event on top of the explicit
        // captures below.
        console.info(error)

        if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error(`Request to ${url} timed out after ${timeoutMs}ms`)

            const timeoutFeatureTag = getFeatureTag(url)
            Sentry.withScope((scope) => {
                scope.setFingerprint(['timeout', sanitizeUrl(url), options.method || 'GET'])
                if (timeoutFeatureTag) scope.setTag('feature', timeoutFeatureTag)

                Sentry.captureException(timeoutError, {
                    level: 'error',
                    extra: {
                        url,
                        method: options.method || 'GET',
                        timeoutMs,
                        requestHeaders: sanitizeHeaders(options.headers || {}),
                        requestBody: sanitizeRequestBody(url, options.body),
                    },
                })
            })

            const userError = new Error('Peanut is taking too long to respond — check your connection and try again.')
            // distinct name from the generic catch below: this path is our own
            // AbortController firing, which an overloaded backend can trigger
            // on a healthy connection — so the copy names both possibilities
            // instead of blaming the user's internet. the generic path also
            // wraps CORS/CSP/TypeError failures and stays fully neutral.
            userError.name = 'ConnectionTimeoutError'
            userError.cause = timeoutError
            throw userError
        }

        let errorMessage: string
        let errorName: string
        let errorStack: string | undefined

        if (error instanceof Error) {
            errorMessage = error.message
            errorName = error.name
            errorStack = error.stack
        } else {
            errorMessage = String(error)
            errorName = 'Unknown Error'
        }

        const networkFeatureTag = getFeatureTag(url)
        Sentry.withScope((scope) => {
            // Set fingerprint for network errors
            scope.setFingerprint(['network-error', sanitizeUrl(url), options.method || 'GET'])
            if (networkFeatureTag) scope.setTag('feature', networkFeatureTag)

            Sentry.captureException(error, {
                extra: {
                    url,
                    method: options.method || 'GET',
                    requestHeaders: sanitizeHeaders(options.headers || {}),
                    requestBody: sanitizeRequestBody(url, options.body),
                    errorMessage,
                    errorName,
                    errorStack,
                },
            })
        })

        const userError = new Error('Something went wrong. Please try again.')
        userError.name = 'ServiceUnavailableError'
        userError.cause = error
        throw userError
    }
}
