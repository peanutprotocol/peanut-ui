import { resolveContentHref } from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { EN_LANDING_CONTENT_HREFS, type LandingContentHrefs } from './landingContentHrefs'

const isDev = process.env.NODE_ENV === 'development'

const hrefsCache = new Map<Locale, LandingContentHrefs>()

/** Homepage content links resolved to their owner locale. Server-only: reads the content mirror. */
export function contentHrefsFor(locale: Locale): LandingContentHrefs {
    if (!isDev) {
        const cached = hrefsCache.get(locale)
        if (cached) return cached
    }
    const resolved = Object.fromEntries(
        Object.entries(EN_LANDING_CONTENT_HREFS).map(([key, href]) => [key, resolveContentHref(href, locale)])
    ) as LandingContentHrefs
    hrefsCache.set(locale, resolved)
    return resolved
}
