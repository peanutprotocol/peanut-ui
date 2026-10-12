import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types'

// Marketing pages taken down for good, without the locale prefix. They answer
// 410 Gone in every locale (proxy.ts), so search engines drop them instead of
// retrying a 404, and the sitemap and footer leave them out.
//
// The UK pages go because marketing never addresses UK residents (UK crypto
// financial-promotions rules, Konrad 2026-10-05). Pages for non-UK users about
// UK rails — send to a UK bank, receive from UK clients — stay.
//
// The 410 does not depend on the content mirror: it answers even while
// src/content still holds the old files. Every path here needs a matching
// entry in the proxy matcher (proxy.ts `config`), or the proxy never sees it.
export const GONE_MARKETING_PATHS: readonly string[] = [
    '/united-kingdom',
    '/send-money-from/united-kingdom/to/argentina',
    '/send-money-from/united-kingdom/to/brazil',
]

/** True for `/{locale}{gone path}`, e.g. `/pt-br/united-kingdom`. */
export function isGoneMarketingPath(pathname: string): boolean {
    const [, locale, ...rest] = pathname.split('/')
    if (!SUPPORTED_LOCALES.includes(locale as Locale)) return false
    return GONE_MARKETING_PATHS.includes(`/${rest.join('/')}`)
}
