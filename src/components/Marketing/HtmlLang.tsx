'use client'

import { useEffect } from 'react'
import type { Locale } from '@/i18n/types'
import { claimHtmlLang, releaseHtmlLang } from '@/i18n/htmlLangClaim'

/**
 * Stamps the page locale onto <html lang>. The root layout sits above the
 * locale segment and can't read route params — and reading headers() there
 * would opt the whole app out of static rendering, which the native builds'
 * static export depends on — so the SSR markup ships lang="en" and this
 * corrects it after hydration. Crawlers rely on hreflang, not lang; this is
 * for assistive tech and in-browser tooling.
 *
 * Claims ownership while mounted so AppIntlProvider — which sits above every
 * route and would otherwise overwrite this with the app locale — stands down.
 */
export function HtmlLang({ locale }: { locale: Locale }) {
    useEffect(() => {
        const previous = document.documentElement.lang
        claimHtmlLang()
        document.documentElement.lang = locale
        return () => {
            // Restore first: releaseHtmlLang lets AppIntlProvider re-apply the
            // app locale over this, which is the right answer whenever one is
            // mounted. The snapshot only stands in when none is.
            document.documentElement.lang = previous
            releaseHtmlLang()
        }
    }, [locale])

    return null
}
