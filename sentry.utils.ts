// Shared Sentry utilities for filtering noise across all configs
// Used by: sentry.client.config.ts, sentry.edge.config.ts, sentry.server.config.ts

import type { ErrorEvent } from '@sentry/nextjs'
import { PAYMENT_NETWORK_PATH, isPaymentNetworkExplorerPath } from '@/utils/private-routes'

interface RoutableSentryEvent {
    request?: { url?: string }
    transaction?: string
}

function sentryValueTargetsPaymentNetwork(value: string | undefined): boolean {
    if (!value) return false
    try {
        if (value.startsWith('/') || /^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
            return isPaymentNetworkExplorerPath(new URL(value, 'https://peanut.invalid').pathname)
        }
    } catch {}
    const pathIndex = value.indexOf(PAYMENT_NETWORK_PATH)
    if (pathIndex < 0) return false
    const routeLikeValue = value.slice(pathIndex).split(/\s/, 1)[0]
    try {
        return isPaymentNetworkExplorerPath(new URL(routeLikeValue, 'https://peanut.invalid').pathname)
    } catch {
        return false
    }
}

export function isPaymentNetworkSentryEvent(event: RoutableSentryEvent): boolean {
    return sentryValueTargetsPaymentNetwork(event.request?.url) || sentryValueTargetsPaymentNetwork(event.transaction)
}

import { CRITICAL_FLOW_TAG } from '@/utils/sentry-critical-flow'

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

    // fetchWithSentry wrapper errors: the underlying timeout/network/HTTP
    // failure is already captured at the fetch site with full context, so the
    // re-thrown ServiceUnavailableError bubbling to global handlers (or being
    // console.error'd by a consumer) would only double-count it (PEANUT-UI-QDJ).
    // Substring-matching these patterns is safe only because both are our own
    // internal fetchWithSentry wrapper names, not generic strings that could
    // appear in an unrelated third-party error message. ConnectionTimeoutError
    // is the timeout-path wrapper; ServiceUnavailableError the generic one.
    // PasskeyError is the same shape one layer up: useZeroDev classifies the raw
    // WebAuthn failure, captures it with full context (or deliberately doesn't,
    // for a plain user cancel), then throws a curated user-facing wrapper. Call
    // sites that re-report that wrapper add a second, context-free event and
    // undo the deliberate silence around LOGIN_CANCELED.
    alreadyReported: ['ServiceUnavailableError', 'ConnectionTimeoutError', 'PasskeyError'],

    // Third-party SDK internal errors (not actionable)
    thirdPartySdkErrors: [
        'IndexedDB:Set:InternalError', // Vercel Analytics storage - fails in private browsing, not actionable
        'Analytics SDK:', // Vercel Analytics errors
        // qr-scanner console.warns this whenever location.protocol !== 'https:',
        // which is always true on capacitor://localhost — it then proceeds and the
        // camera works. Pure noise on native (PEANUT-UI-R1M).
        'The camera stream is only accessible if the page is transferred via https',
        // OneSignal's worker messenger console.errors this whenever it wants to
        // talk to a service worker that isn't registered yet — on first load, and
        // on every native launch where the SW never registers at all. It retries,
        // and nothing user-visible depends on it.
        '[WM] No SW registration for postMessage',
    ],
}

/**
 * Capgo's background updater logs every transient CDN/network hiccup at error
 * level, and captureConsoleIntegration promotes each one into a Sentry event
 * (~95/day on native). The user never sees them: the updater just retries on
 * the next launch. Suppress those, but keep the failures that mean OTA is
 * genuinely broken rather than merely flaky — a bundle that semver-sorts below
 * the installed binary, one that arrived corrupt, or one the plugin rolled back
 * because notifyAppReady never landed. That last class is the reason this list
 * is not just the two it started with: an update that silently un-happens
 * leaves no other trace, and suppressing it made the whole population read as
 * one event in 90 days (PEANUT-UI-SVT).
 */
const CAPGO_LOG_PREFIXES = ['[CapgoUpdater]', 'CapgoUpdater :', '[capgo]']
const CAPGO_ACTIONABLE = [
    'disable_auto_update_under_native',
    'Checksum mismatch',
    'notifyAppReady was not called',
    'Update to bundle:',
]

const isFromCapgo = (searchTexts: string[]): boolean =>
    searchTexts.some((text) => CAPGO_LOG_PREFIXES.some((prefix) => text.includes(prefix)))

function isActionableCapgoError(searchTexts: string[]): boolean {
    return isFromCapgo(searchTexts) && searchTexts.some((text) => CAPGO_ACTIONABLE.some((p) => text.includes(p)))
}

export function isTransientCapgoNoise(searchTexts: string[]): boolean {
    return isFromCapgo(searchTexts) && !isActionableCapgoError(searchTexts)
}

/**
 * OneSignal's op queue console.errors a failed operation with the whole op
 * payload inlined, and that payload carries a per-device `onesignalId`. Since
 * captureConsoleIntegration groups a stackless message event by its text, every
 * device minted its OWN Sentry issue — unbounded issue creation for what is one
 * failure mode.
 *
 * These are not dropped: push-subscription writes failing is worth watching
 * (iOS push was silently dead for months on a mis-provisioned APNs key), so
 * they collapse onto one issue per op name instead, where the rate is legible.
 */
const ONESIGNAL_OP_FAILURE = /^Op failed[^:]*:\s*\[?\s*\{\s*"name"\s*:\s*"([^"]+)"/

function collapseNoisyFingerprint(event: ErrorEvent): void {
    const opName = event.message?.match(ONESIGNAL_OP_FAILURE)?.[1]
    if (opName) {
        event.fingerprint = ['onesignal-op-failed', opName]
    }
}

const FETCH_SITE_FINGERPRINTS = ['network-error', 'timeout']
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/*
 * Exported so fetchWithSentry's outage dedupe and the rescue below cannot drift
 * apart on what counts as a mutation. They have to agree: if the dedupe ever
 * suppresses a request this rescue would have kept, the event is gone before
 * `beforeSend` runs and the rescue is silently inert.
 */
export function isMutatingMethod(method: string | undefined): boolean {
    return MUTATING_METHODS.includes((method || '').toUpperCase())
}

/*
 * The method comes from the `http.method` tag, with the fingerprint's third
 * slot as fallback. The timeout capture no longer carries url and method in its
 * fingerprint — it groups on `['timeout']` alone so one phenomenon is one issue
 * — and reading the method positionally would have made this rescue silently
 * inert for exactly the events it exists to keep: a POST that dies on the
 * network. The fallback keeps the non-2xx and network-error captures, which
 * still fingerprint positionally, working unchanged.
 */
function isFetchSiteMutationFailure(event: ErrorEvent): boolean {
    const [kind, , fingerprintMethod] = event.fingerprint ?? []
    const method = event.tags?.['http.method'] ?? fingerprintMethod
    return FETCH_SITE_FINGERPRINTS.includes(kind) && isMutatingMethod(typeof method === 'string' ? method : undefined)
}

/*
 * A frame that did not come from our bundle and did not come from a URL we can
 * name. Extensions are the obvious case, but the ones that actually cost us are
 * the injected content scripts that carry NO scheme at all: PEANUT-UI-SNS threw
 * ~3.7k unhandled rejections from `app:///executors/200.js` (a wallet-style
 * injector reading `M_ID` off an undefined global), which the scheme-only check
 * could not see, so it had to be archived by hand.
 *
 * `app:///` is Sentry's own rewrite for a script whose origin it cannot resolve.
 * Our first-party frames always resolve to `/_next/`, so keying on the executors
 * path is safe — deliberately not "any app:/// frame", which would swallow real
 * bundles whose sourcemap upload lagged a deploy.
 */
const THIRD_PARTY_SCRIPT_FRAMES = [
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'app:///executors/',
]

export function isThirdPartyScriptFrame(filename: string): boolean {
    return THIRD_PARTY_SCRIPT_FRAMES.some((pattern) => filename.includes(pattern))
}

/**
 * The texts every noise predicate matches against, one entry per field.
 * Matching each field independently — rather than one concatenated string —
 * keeps a pattern from matching across unrelated fields and suppressing a
 * legitimate event. Shared with the PostHog mirror wrapper in sentry-init so
 * both filters read the same event the same way.
 *
 * Class names come from every link in the chain. Sentry orders `exception.values`
 * root-cause-first, so a wrapper carrying a `cause` lands at the END — exactly
 * where fetchWithSentry's ServiceUnavailableError and useZeroDev's PasskeyError
 * always sit. Reading only values[0] left `alreadyReported` inert for a month:
 * PEANUT-UI-SNP kept double-counting PEANUT-UI-QEY.
 *
 * Deliberately types only, not messages. Class names are exact, so matching them
 * chain-wide can only catch our own wrappers. Widening the fuzzy message patterns
 * the same way would suppress MORE — the failure 5343f1d0 just fixed, where viem's
 * "Details: Failed to fetch" ate real payment errors via `networkIssues`.
 */
export function getEventSearchTexts(event: ErrorEvent): string[] {
    const message = event.message || ''
    const exceptionValue = event.exception?.values?.[0]?.value || ''
    const culprit = (event as any).culprit || ''
    const exceptionTypes = (event.exception?.values ?? []).map((v) => v.type || '')
    return [message, exceptionValue, culprit, ...exceptionTypes]
}

/**
 * Check if error message matches any ignored pattern
 */
export function shouldIgnoreError(event: ErrorEvent): boolean {
    // Explicit captures from money-moving flows are never noise. Cancellations
    // stay filtered even there — a user backing out of the passkey sheet is not
    // a defect, and those would drown out the real failures.
    const isCriticalFlow = Boolean(event.tags?.[CRITICAL_FLOW_TAG])
    const searchTexts = getEventSearchTexts(event)

    /*
     * Rescue actionable OTA failures BEFORE the generic patterns run. The Capgo
     * carve-out below can only ever ADD suppression — once the loop returns true
     * nothing downstream can take it back — so a corrupt bundle whose text happens
     * to contain a fuzzy pattern ('… Checksum mismatch: Network Error' hitting
     * `networkIssues`) would be dropped and the carve-out silently inert for that
     * whole class. Exactly how `alreadyReported` went unnoticed for a month.
     */
    if (isActionableCapgoError(searchTexts)) return false

    /*
     * Rescue the fetch-site capture for MUTATIONS only, and here rather than
     * lower down for the same reason as the Capgo carve-out: once the loop
     * below returns true nothing can take it back.
     *
     * `fetchWithSentry` sets fingerprint [kind, url, method] and captures with
     * full context before rethrowing a wrapper for the UI. `alreadyReported`
     * drops that rethrow on the grounds that the fetch-site capture survived —
     * it did not, `networkIssues` matched the engine's own `Failed to fetch` /
     * `Load failed` copy and ate it too. So a POST that dies on the network is
     * invisible: the user gets "contact support" and we get nothing, which is
     * the exact failure `criticalFlowTags` was added to prevent and never did
     * (3 call sites, 0 events in 30d).
     *
     * Restricted to mutating methods on purpose. Failed GETs are 78% of this
     * population and land on /home — balance and price polls that retry and
     * succeed, whose rate belongs in PostHog (grouped, rate-limited) and not as
     * ~7k individual Sentry events a week. A failed mutation is different in
     * kind: it is a user losing progress in a flow that moves money, it cannot
     * be silently retried, and there are few of them.
     *
     * Keyed on the fingerprint, never the message, so it can only ever rescue
     * our own wrapper and not an incidental network TypeError from a
     * third-party SDK.
     */
    if (isFetchSiteMutationFailure(event)) return false

    // Check all ignore patterns
    for (const [group, patterns] of Object.entries(IGNORED_ERRORS)) {
        if (isCriticalFlow && group !== 'userRejected') continue
        for (const pattern of patterns) {
            if (searchTexts.some((text) => text.toLowerCase().includes(pattern.toLowerCase()))) {
                return true
            }
        }
    }

    if (isCriticalFlow) return false

    if (isTransientCapgoNoise(searchTexts)) {
        return true
    }

    // Ignore errors from browser extensions (client-side only, but safe to check everywhere)
    const frames = (event.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? [])
    for (const frame of frames) {
        const filename = frame.filename || ''
        if (isThirdPartyScriptFrame(filename)) {
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
    collapseNoisyFingerprint(event)
    cleanSensitiveHeaders(event)
    // Whether the device believed it was online at capture time — the free
    // half of the TASK-21956 network triage (navigator is absent server-side).
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        event.tags = { net_online: String(navigator.onLine), ...event.tags }
    }
    return event
}

export function beforeSendRouteAwareHandler(event: ErrorEvent): ErrorEvent | null {
    return isPaymentNetworkSentryEvent(event) ? null : beforeSendHandler(event)
}

export function beforeSendRouteAwareTransaction<T extends RoutableSentryEvent>(event: T): T | null {
    return isPaymentNetworkSentryEvent(event) ? null : event
}
