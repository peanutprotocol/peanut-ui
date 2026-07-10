import * as Sentry from '@sentry/nextjs'

import { type JSONValue } from '../interfaces/interfaces'
import { reportNetworkError, reportNetworkOk } from './connectivity'

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

/** Use configured fetch timeout or default to 10s
 * We use 10s because vercel function timout is 15s and this function
 * can be called in that context, and we preffer to have control over
 * the error message and handling
 */
const DEFAULT_TIMEOUT_MS =
    process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS && !isNaN(parseInt(process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS, 10))
        ? parseInt(process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS, 10)
        : 10000

const getErrorLevelFromStatus = (status: number): Sentry.SeverityLevel => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'info'
}

const sanitizeHeaders = (headers: any): any => {
    if (!headers) return headers

    const sanitized = { ...headers }
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

export const fetchWithSentry = async (
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
    // Sanitize URL for fingerprinting by replacing IDs with placeholders
    const sanitizeUrl = (url: string) => {
        return (
            url
                // Replace numeric IDs in path
                .replace(/\/\d+(?=\/|$)/g, '/{id}')
                // Replace UUIDs in path
                .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{uuid}')
                // Replace numeric IDs in query params
                .replace(/([?&][^=&]*=)\d+/g, '$1{id}')
        )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        })

        clearTimeout(timeoutId)
        // A response came back — the backend is reachable, clear any failure streak.
        reportNetworkOk()

        if (!response.ok) {
            // Skip both the console warn AND Sentry submission for expected
            // non-2xx responses (username availability 404, get-user-from-cookie
            // 401 on cleared session, etc). Logging them clutters DevTools and
            // gets picked up by forward-logs-shared as Sentry breadcrumbs.
            if (!shouldSkipReporting(url, response.status)) {
                console.warn(`Request to ${String(url).replace(/[\r\n]/g, '')} failed with status ${response.status}`)

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
        }

        return response
    } catch (error: unknown) {
        clearTimeout(timeoutId)
        // fetch rejected (timeout / DNS / connection refused) — the request never
        // reached the backend, so flag a connectivity failure.
        reportNetworkError()
        console.error(error)

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

            const userError = new Error('Service temporarily unavailable. Please try again.')
            userError.name = 'ServiceUnavailableError'
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
            errorMessage = (error as any).toString()
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
