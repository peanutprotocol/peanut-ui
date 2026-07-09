// Shared Sentry utilities for filtering noise across all configs
// Used by: sentry.client.config.ts, sentry.edge.config.ts, sentry.server.config.ts

import type { ErrorEvent } from '@sentry/nextjs'

/**
 * Patterns to filter out from Sentry reporting.
 * These are generally noise that doesn't require action.
 */
const IGNORED_ERRORS = {
    // User-initiated cancellations (not bugs)
    userRejected: [
        'User rejected',
        'user rejected',
        'User denied',
        'not allowed by the user',
        'User cancelled',
        'user cancelled',
        'Request rejected',
        'AbortError',
        'The operation was aborted',
    ],
    perks: ['This payment is not eligible for a perk'],

    networkIssues: ['Network Error', 'Failed to fetch', 'Load failed'],

    // Browser/extension noise (mostly client-side, but included for consistency)
    browserNoise: [
        'ResizeObserver loop',
        'ResizeObserver loop limit exceeded',
        'Script error.',
        // Extension interference
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
    ],

    // Third-party scripts we don't control
    thirdParty: ['googletagmanager', 'gtag', 'analytics', 'hotjar', 'clarity', 'intercom', 'crisp'],

    // Third-party SDK internal errors (not actionable)
    thirdPartySdkErrors: [
        'IndexedDB:Set:InternalError', // Vercel Analytics storage - fails in private browsing, not actionable
        'Analytics SDK:', // Vercel Analytics errors
        // qr-scanner console.warns this whenever location.protocol !== 'https:',
        // which is always true on capacitor://localhost — it then proceeds and the
        // camera works. Pure noise on native (PEANUT-UI-R1M).
        'The camera stream is only accessible if the page is transferred via https',
    ],
}

/**
 * Check if error message matches any ignored pattern
 */
export function shouldIgnoreError(event: ErrorEvent): boolean {
    const message = event.message || ''
    const exceptionValue = event.exception?.values?.[0]?.value || ''
    const exceptionType = event.exception?.values?.[0]?.type || ''
    const culprit = (event as any).culprit || ''

    const searchText = `${message} ${exceptionValue} ${exceptionType} ${culprit}`.toLowerCase()

    // Check all ignore patterns
    for (const patterns of Object.values(IGNORED_ERRORS)) {
        for (const pattern of patterns) {
            if (searchText.includes(pattern.toLowerCase())) {
                return true
            }
        }
    }

    // Ignore errors from browser extensions (client-side only, but safe to check everywhere)
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || []
    for (const frame of frames) {
        const filename = frame.filename || ''
        if (
            filename.includes('chrome-extension://') ||
            filename.includes('moz-extension://') ||
            filename.includes('safari-extension://')
        ) {
            return true
        }
    }

    return false
}

/**
 * Defense-in-depth: even when call-site code (fetchWithSentry, etc) has
 * already scrubbed payloads, walk every Sentry event one more time and
 * redact known sensitive headers, fields, and breadcrumb data before it
 * leaves the browser. Catches the long tail of errors that come from
 * places we don't control (third-party SDKs, error boundaries, console
 * spam) and might carry PII / card data / passwords in `extra`.
 *
 * What stays unredacted: userId, username, email, inviteCode — identity
 * fields already shared with PostHog and intentionally queryable in
 * Sentry too.
 */
const SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-auth-token',
    'api-key',
    'x-api-key',
    'apikey',
    'md-api-key',
    'x-app-token',
    'x-app-access-sig',
    'x-app-access-ts',
]

/**
 * IMPORTANT: EXACT-MATCH set. We deliberately do NOT substring-match
 * because Peanut has first-class onchain addresses everywhere (walletAddress,
 * recipientAddress, tokenAddress, sdaAddress, depositAddress, …) and those
 * are public chain data that must stay visible. Substring on `address`
 * would clobber every one. Same for `pin` / `token` / `seed` — share names
 * with non-sensitive concepts.
 */
const SENSITIVE_KEYS = new Set([
    // Secrets
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
    // Bank accounts
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
    'dob',
    'dateofbirth',
    'birthdate',
    'birthday',
    'phonenumber',
    'mobilenumber',
    'telephone',
    'telefono',
    // 2FA
    'otp',
    'verificationcode',
    'totpsecret',
    'twofactor',
    'twofactorsecret',
])

function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''))
}

function scrubObject(value: unknown, depth = 0): unknown {
    if (depth > 15) return '[REDACTED: max depth]'
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((item) => scrubObject(item, depth + 1))
    // Prototype-pollution defense — see src/utils/sentry.utils.ts for the
    // full rationale. Object.create(null) + Object.defineProperty + explicit
    // dangerous-key skip. The defineProperty form is what CodeQL recognises
    // as a sanitizer; direct `out[key] = …` triggers the alert even when
    // keys are validated at runtime.
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

/**
 * Clean sensitive headers, extras, request data, and breadcrumbs from events
 * before they leave the browser.
 */
export function cleanSensitiveHeaders(event: ErrorEvent): void {
    if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
            if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
                event.request.headers[key] = '[REDACTED]'
            }
        }
    }
    if (event.request?.data) {
        event.request.data = scrubObject(event.request.data)
    }
    if (event.extra) {
        event.extra = scrubObject(event.extra) as Record<string, unknown>
    }
    if (event.contexts) {
        for (const [key, value] of Object.entries(event.contexts)) {
            if (key === 'trace') continue
            ;(event.contexts as Record<string, unknown>)[key] = scrubObject(value)
        }
    }
    if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
            ...crumb,
            data: crumb.data
                ? (Object.fromEntries(
                      Object.entries(crumb.data).map(([k, v]) => [k, isSensitiveKey(k) ? '[REDACTED]' : scrubObject(v)])
                  ) as Record<string, unknown>)
                : crumb.data,
        }))
    }
}

/**
 * Standard beforeSend handler for all Sentry configs
 */
export function beforeSendHandler(event: ErrorEvent): ErrorEvent | null {
    if (shouldIgnoreError(event)) {
        return null
    }
    cleanSensitiveHeaders(event)
    return event
}
