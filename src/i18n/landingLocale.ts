import { toMarketingLocale, withCountry } from './localeBridge'
import { DEFAULT_LOCALE, type Locale } from './types'

// The language rule of every landing page whose URL carries no locale: `/` (the proxy redirects to
// the localized home) and the creator pages at /c/<username> (rendered in place). One rule, so a
// visitor gets the same language on both.

/** Vercel's edge geolocation header. Absent locally and in tests, which means no tiebreaker. */
export const COUNTRY_HEADER = 'x-vercel-ip-country'

const CRAWLER_UA =
    /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|linkedinbot|embedly|quora link preview|pinterest|vkshare|redditbot|applebot|semrush|ahrefs|screaming frog/i

function isCrawler(userAgent: string | null): boolean {
    // No UA at all is not a browser either: treat it as a bot.
    return !userAgent || CRAWLER_UA.test(userAgent)
}

/**
 * Highest-quality Accept-Language range that maps onto a supported locale.
 * An explicit English range wins at its own position, so `en;q=1, es;q=0.5`
 * stays English rather than being dragged to the first non-default match.
 */
function preferredLocale(header: string | null): Locale {
    if (!header) return DEFAULT_LOCALE
    const ranges = header
        .split(',')
        .map((part) => {
            const [tag, ...params] = part.trim().split(';')
            const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
            return { tag: tag.trim().toLowerCase(), quality: q ? Number.parseFloat(q.slice(2)) : 1 }
        })
        .filter((range) => range.tag && Number.isFinite(range.quality) && range.quality > 0)
        .sort((a, b) => b.quality - a.quality)
    for (const { tag } of ranges) {
        if (tag === 'en' || tag.startsWith('en-') || tag === '*') return DEFAULT_LOCALE
        const locale = toMarketingLocale(tag)
        if (locale !== DEFAULT_LOCALE) return locale
    }
    return DEFAULT_LOCALE
}

/**
 * The visitor's landing-page language. The `app-locale` cookie (an explicit choice) wins; a
 * first-time visitor falls back to Accept-Language, with the CDN's country header breaking ties
 * inside Spanish (see withCountry: es-419 is an exact match for the Chrome build shipped across
 * Latin America, so nothing else distinguishes an Argentine visitor). Crawlers get English:
 * Google's localized-versions guidance warns against language-sniffing because crawlers arrive
 * from US IPs sending `en`. Unsupported languages fall back to English.
 */
export function landingLocale(request: {
    storedLocale: string | undefined
    acceptLanguage: string | null
    country: string | null
    userAgent: string | null
}): Locale {
    if (request.storedLocale) return toMarketingLocale(request.storedLocale)
    if (isCrawler(request.userAgent)) return DEFAULT_LOCALE
    return withCountry(preferredLocale(request.acceptLanguage), request.country)
}
