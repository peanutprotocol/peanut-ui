import { COUNTRY_HEADER, landingLocale } from '@/i18n/landingLocale'
import { LOCALE_COOKIE } from '@/i18n/localeBridge'
import type { Locale } from '@/i18n/types'

type CookieReader = { get: (name: string) => { value: string } | undefined }

/**
 * The language of a creator page: the same rule as every landing page without a locale in its URL
 * (landingLocale, which also picks the language of `/`). The page renders in place, so the short
 * link /c/<username> stays as it is. Presentation only: no event value comes from it.
 */
export function creatorPageLocale(cookieStore: CookieReader, requestHeaders: Headers): Locale {
    return landingLocale({
        storedLocale: cookieStore.get(LOCALE_COOKIE)?.value,
        acceptLanguage: requestHeaders.get('accept-language'),
        country: requestHeaders.get(COUNTRY_HEADER),
        userAgent: requestHeaders.get('user-agent'),
    })
}
