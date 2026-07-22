// url helpers for native app dynamic routes.
// in capacitor (static export), dynamic routes don't work — use query params instead.
// on web, use the normal path-based urls.

import { couldBeRecipient, isReservedRoute } from '@/constants/routes'
import { isCapacitor } from './capacitor'

// Deep links are peanut.me links by definition — that's the host the Android
// App Links filter and the AASA are bound to. Deliberately not derived from
// NEXT_PUBLIC_BASE_URL: a build pointed at a preview origin must still route a
// real peanut.me notification link.
const APP_HOSTS = /^(.+\.)?peanut\.me$/

export function profileUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${encodeURIComponent(username)}` : `/${username}`
}

export function sendUrl(username: string): string {
    return isCapacitor() ? `/send?recipient=${encodeURIComponent(username)}` : `/send/${username}`
}

// Pay/send to an arbitrary recipient PATH — covers usernames AND addresses/ENS,
// optionally with chain + amount + token (e.g. `0xabc@1/100usdc`, `vitalik.eth`).
// Web uses the [...recipient] catch-all; native (no dynamic routes) funnels it
// into /send?recipient=, which SendRouterView dispatches by recipient type.
export function recipientPayUrl(path: string): string {
    return isCapacitor() ? `/send?recipient=${encodeURIComponent(path)}` : `/${path}`
}

export function requestUrl(username: string): string {
    return isCapacitor() ? `/request?recipient=${encodeURIComponent(username)}` : `/request/${username}`
}

export function qrClaimUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${encodeURIComponent(code)}` : `/qr/${code}`
}

export function qrSuccessUrl(code: string): string {
    return isCapacitor() ? `/qr?code=${encodeURIComponent(code)}&view=success` : `/qr/${code}/success`
}

// these always use query params — they route to /pay-request which is a static page
// on both web and native. no dynamic path equivalent exists.
export function chargePayUrl(chargeId: string, context?: string): string {
    const qs = context ? `&context=${encodeURIComponent(context)}` : ''
    return `/pay-request?chargeId=${encodeURIComponent(chargeId)}${qs}`
}

export function requestPotUrl(id: string): string {
    return `/pay-request?id=${encodeURIComponent(id)}`
}

export function addMoneyCountryUrl(countryPath: string): string {
    return isCapacitor() ? `/add-money?country=${encodeURIComponent(countryPath)}` : `/add-money/${countryPath}`
}

export function withdrawCountryUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${encodeURIComponent(countryPath)}${qs}`
    }
    return `/withdraw/${countryPath}${queryParams || ''}`
}

export function withdrawBankUrl(countryPath: string, queryParams?: string): string {
    if (isCapacitor()) {
        const qs = queryParams ? `&${queryParams.replace('?', '')}` : ''
        return `/withdraw?country=${encodeURIComponent(countryPath)}&view=bank${qs}`
    }
    return `/withdraw/${countryPath}/bank${queryParams || ''}`
}

/**
 * Maps an incoming deep link — an App-Links URL (https://peanut.me/<path>) or a
 * bare path from a push payload — to the path the native static export can
 * actually render. Dynamic web routes are funnelled through the same query-param
 * helpers used to build outbound links, so `/send/<user>` → `/send?recipient=<user>`,
 * `/qr/<code>` → `/qr?code=<code>`, `/add-money/<country>/bank` →
 * `/add-money?country=<country>&view=bank`, etc. Static routes (e.g. `/card`,
 * `/pay-request`) pass through unchanged.
 *
 * Returns null for an unparseable link or one pointing at another host — an
 * off-domain URL must stay off-domain rather than be rewritten into a bogus
 * in-app path.
 */
export function deepLinkToNativePath(url: string): string | null {
    try {
        return mapDeepLink(url)
    } catch {
        // The whole body is guarded, not just the URL parse: decodeURIComponent
        // throws URIError on a stray `%`, and this runs during render in the
        // notifications list — one malformed ctaDeeplink would blank the page.
        return null
    }
}

function mapDeepLink(url: string): string | null {
    // Relative base: push payloads carry the canonical path (`/receipt/<id>`),
    // App Links carry the full URL. Both must resolve.
    const parsed = new URL(url, 'https://peanut.me')
    if (!APP_HOSTS.test(parsed.hostname)) return null

    const path = parsed.pathname
    const extraParams = parsed.search.replace(/^\?/, '')
    const segments = path.split('/').filter(Boolean)

    if (segments[0] === 'send' && segments[1]) {
        return appendParams(sendUrl(decodeURIComponent(segments.slice(1).join('/'))), extraParams)
    }
    if (segments[0] === 'request' && segments[1]) {
        return appendParams(requestUrl(decodeURIComponent(segments.slice(1).join('/'))), extraParams)
    }
    if (segments[0] === 'qr' && segments[1]) {
        const code = decodeURIComponent(segments[1])
        return appendParams(segments[2] === 'success' ? qrSuccessUrl(code) : qrClaimUrl(code), extraParams)
    }
    if (segments[0] === 'add-money' || segments[0] === 'withdraw') {
        return rewriteMethodPath(path, extraParams || undefined)
    }
    // `/receipt/<id>?kind=X` — the web receipt page is a server component and is
    // stripped from the static export (scripts/native-build.js), so native routes
    // to the client variant. `kind` rides along in extraParams.
    if (segments[0] === 'receipt' && segments[1]) {
        const id = decodeURIComponent(segments[1])
        return appendParams(isCapacitor() ? `/receipt?id=${encodeURIComponent(id)}` : path, extraParams)
    }
    // `/<username>?chargeId=<uuid>` — the catch-all profile route is disabled in
    // native builds; /pay-request is its stand-in (see (mobile-ui)/pay-request).
    // Gated by the same reserved-route/recipient rules the web catch-all uses, so
    // `/rewards?chargeId=x` stays on /rewards instead of landing on /pay-request.
    if (isCapacitor() && segments.length === 1 && !isReservedRoute(path) && couldBeRecipient(segments[0])) {
        const chargeId = parsed.searchParams.get('chargeId')
        if (chargeId) return chargePayUrl(chargeId)
    }

    return appendParams(path, extraParams)
}

function appendParams(base: string, params: string): string {
    if (!params) return base
    return `${base}${base.includes('?') ? '&' : '?'}${params}`
}

/**
 * rewrites a dynamic method.path for capacitor mode.
 * converts paths like /add-money/belgium/bank → /add-money?country=belgium&view=bank
 * and /withdraw/be/bank → /withdraw?country=be&view=bank
 * on web, returns the path unchanged.
 */
export function rewriteMethodPath(path: string, extraParams?: string): string {
    if (!isCapacitor()) return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path

    // parse paths like /add-money/{country}/bank or /withdraw/{country}/bank
    const addMoneyMatch = path.match(/^\/add-money\/([^/?]+)(?:\/([^/?]+))?/)
    if (addMoneyMatch) {
        const country = addMoneyMatch[1]
        const subView = addMoneyMatch[2] // bank, manteca, etc.
        let url = `/add-money?country=${country}`
        if (subView) url += `&view=${subView}`
        if (extraParams) url += `&${extraParams}`
        return url
    }

    const withdrawMatch = path.match(/^\/withdraw\/([^/?]+)(?:\/([^/?]+))?/)
    if (withdrawMatch) {
        const country = withdrawMatch[1]
        const subView = withdrawMatch[2]
        // skip manteca (it's a static route, not dynamic)
        if (country === 'manteca' || country === 'crypto') {
            return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path
        }
        let url = `/withdraw?country=${country}`
        if (subView) url += `&view=${subView}`
        if (extraParams) url += `&${extraParams}`
        return url
    }

    // not a dynamic route — return as-is
    return extraParams ? `${path}${path.includes('?') ? '&' : '?'}${extraParams}` : path
}
