import type { CapturedNetworkRequest } from 'posthog-js'

/*
 * A send link carries its bearer secret in the URL fragment:
 * `/claim?c=42161&v=v4.4&i=552#p=<secret>`. Whoever reads the secret can claim
 * the link. A browser never sends the fragment to a server, but analytics and
 * error reporting copy `window.location.href` into every event, and the claim
 * CTA copies the whole URL, fragment included, percent-encoded into the
 * `redirect_uri` query of /setup and /invite.
 */

// A raw fragment runs to the end of the URL, so everything after `#p=` goes.
const RAW_SECRET_FRAGMENT = /#p=[^\s"'<>]*/gi
// `#p=` percent-encoded one or more times inside a query value, which ends at `&`.
const ENCODED_SECRET_FRAGMENT = /%(?:25)*23p%(?:25)*3d[^\s"'<>&]*/gi
// Properties that hold a URL: `$current_url`, `$referrer`, `$initial_current_url`,
// `$session_entry_url`, `href`, `navigationURL`, ... A fragment there is never
// analytics data, and a fragment we do not know about may be a secret too.
const URL_KEY = /url|href|referrer/i

/** Removes every send-link secret (`#p=…`, raw or percent-encoded) from a string. */
export function stripLinkSecrets(value: string): string {
    return value.replace(RAW_SECRET_FRAGMENT, '').replace(ENCODED_SECRET_FRAGMENT, '')
}

/** A URL without its fragment and without any encoded send-link secret in its query. */
export function stripUrlSecrets(url: string): string {
    return stripLinkSecrets(url.split('#')[0])
}

/**
 * Removes send-link secrets from every string in an event, in place: PostHog
 * properties, `$set` and `$set_once`, Sentry request, breadcrumbs, messages and
 * stack values. A string under a URL-like key also loses its whole fragment.
 */
export function redactLinkSecrets<T>(value: T): T {
    const seen = new WeakSet<object>()
    const scrub = (input: unknown, key: string): unknown => {
        if (typeof input === 'string') return URL_KEY.test(key) ? stripUrlSecrets(input) : stripLinkSecrets(input)
        if (!input || typeof input !== 'object' || seen.has(input)) return input
        seen.add(input)
        // A replay event with `cv` holds gzip bytes as a string. A pattern match
        // there is noise, and an edit would corrupt the recording.
        if (typeof (input as { cv?: unknown }).cv === 'string') return input
        for (const childKey of Object.keys(input)) {
            if (childKey === '__proto__' || childKey === 'constructor' || childKey === 'prototype') continue
            const current = (input as Record<string, unknown>)[childKey]
            const next = scrub(current, childKey)
            if (next !== current)
                Object.defineProperty(input, childKey, {
                    value: next,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                })
        }
        return input
    }
    return scrub(value, '') as T
}

/**
 * Session replay hook for network entries. posthog-js also passes the page URL
 * of every replay Meta event through it as `{ name: href }`.
 */
export function maskLinkSecretsInReplayRequest(request: CapturedNetworkRequest): CapturedNetworkRequest {
    return typeof request.name === 'string' ? { ...request, name: stripUrlSecrets(request.name) } : request
}
