/**
 * Typed builder + controlled vocabulary for `utm_*` parameters on outbound links.
 *
 * PostHog auto-captures these on `$pageview` and stamps `$initial_utm_*` on the
 * anonymous distinct_id, so the values that flow through this builder become
 * PostHog dimensions on every signup. Typos silently fork the funnel — funneling
 * through `withUtm()` makes the typo a typecheck error instead.
 *
 * Team conventions + closed-enum rationale live in `mono/strategy/utm-tracking.md`.
 * Read that before adding a new medium.
 */

/**
 * Channel category — the analytical bucket we slice the funnel by.
 *
 * Keep this set small. Every new medium dilutes dashboards; adding one is a
 * team conversation (see `mono/strategy/utm-tracking.md`).
 */
export const UTM_MEDIUMS = {
    /** Co-branded merchant landing pages (`/m/[slug]`). */
    MERCHANT: 'merchant',
    /** Peer-to-peer share links emitted by an existing Peanut user. */
    REFERRAL: 'referral',
    /** Any email — newsletter, drip, transactional. */
    EMAIL: 'email',
    /** Push / in-app notification blasts (delivered via OneSignal). */
    PUSH: 'push',
    /** Organic social posts. */
    SOCIAL: 'social',
    /** Paid acquisition where we pay per click (Google ads, Meta ads). */
    CPC: 'cpc',
    /** Paid acquisition where we pay per impression. */
    CPM: 'cpm',
    /** Paid ambassador / creator partnership (distinct from organic referral). */
    AMBASSADOR: 'ambassador',
} as const

/**
 * Publishing surface — where the click physically came from.
 *
 * Add new sources here before using them in code so we keep one canonical list.
 */
export const UTM_SOURCES = {
    /** `/m/[slug]` merchant landing pages. */
    MERCHANT_LANDING: 'm',
    /** In-app share buttons / native share sheets. */
    APP_SHARE: 'app',
    /** `/content/*` SEO hub. */
    CONTENT_HUB: 'c',
    /** Beehiiv-driven email. */
    BEEHIIV: 'beehiiv',
    /** OneSignal-delivered messages (push + email blasts). Split by medium. */
    ONESIGNAL: 'onesignal',
    TWITTER: 'twitter',
    INSTAGRAM: 'instagram',
    TIKTOK: 'tiktok',
    TELEGRAM: 'telegram',
    /** Google ads / search. */
    GOOGLE: 'google',
    /** Meta ads (Facebook + Instagram). */
    META: 'meta',
} as const

export type UtmMedium = (typeof UTM_MEDIUMS)[keyof typeof UTM_MEDIUMS]
export type UtmSource = (typeof UTM_SOURCES)[keyof typeof UTM_SOURCES]

export type UtmParams = {
    source: UtmSource
    medium: UtmMedium
    /** lowercase-kebab. For merchant landings: the merchant slug. */
    campaign: string
    /** CTA / placement / variant within a campaign. e.g. `hero`, `end_fold`. */
    content?: string
    /** Search keyword / audience segment. Rare outside paid search. */
    term?: string
}

/**
 * Build a URL with `utm_*` params appended.
 *
 * @param path  Path or full URL — query string is preserved.
 * @param utm   The four mandatory + two optional UTM fields.
 * @param extra Additional non-UTM query params (e.g. `code` for invite links).
 *              These come first in the resulting query string to match the
 *              existing convention on merchant LPs (`?code=…&utm_…`).
 */
export function withUtm(path: string, utm: UtmParams, extra?: Record<string, string>): string {
    const params = new URLSearchParams()
    if (extra) {
        for (const [k, v] of Object.entries(extra)) params.set(k, v)
    }
    params.set('utm_source', utm.source)
    params.set('utm_medium', utm.medium)
    params.set('utm_campaign', utm.campaign)
    if (utm.content) params.set('utm_content', utm.content)
    if (utm.term) params.set('utm_term', utm.term)
    // Keep any #fragment trailing the query string — otherwise the UTM params
    // land after the hash and get dropped. Fragment = everything past first '#'.
    const hashIdx = path.indexOf('#')
    const base = hashIdx === -1 ? path : path.slice(0, hashIdx)
    const hash = hashIdx === -1 ? '' : path.slice(hashIdx)
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}${params.toString()}${hash}`
}
