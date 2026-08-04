'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import { getTranslations } from '@/i18n'
import { LOCALE_COOKIE, toAppLocale, toMarketingLocale } from '@/i18n/localeBridge'
import { persistLocale } from '@/i18n/app/locale-store'
import { type Locale } from '@/i18n/types'
import { localeHref } from './LocaleSwitcher'

const DISMISS_KEY = 'locale-suggestion-dismissed'

// Banner is switched off: first-visit language now comes from the proxy's
// Accept-Language redirect (crawlers exempt), and the footer switcher covers
// explicit choice. Mounts stay wired so flipping this re-enables it everywhere.
const BANNER_ENABLED = false

/**
 * Offers a first-time visitor the page in their browser's language instead of
 * redirecting them into it — the behaviour Google's localized-versions guidance
 * asks for, and the reason middleware.ts only acts on an explicit cookie.
 *
 * Renders nothing once the visitor has chosen a language (the shared
 * `app-locale` cookie) or dismissed the offer.
 */
export function LocaleSuggestion({ locale }: { locale: Locale }) {
    const pathname = usePathname() ?? '/'
    const [suggested, setSuggested] = useState<Locale | null>(null)

    // Browser-only signals, so this can't run until after mount — which also
    // keeps it out of the SSR markup and away from hydration mismatches.
    useEffect(() => {
        if (!BANNER_ENABLED) return
        if (Cookies.get(LOCALE_COOKIE)) return
        try {
            if (localStorage.getItem(DISMISS_KEY)) return
        } catch {
            // private mode — treat as not dismissed
        }
        const preferred = toMarketingLocale(navigator.language)
        if (preferred !== locale) setSuggested(preferred)
    }, [locale])

    // Always render the wrapper, even when there's nothing to suggest. Returning
    // null during SSR leaves React no anchor for the node the effect creates
    // later, and on the landing page — whose parent container is <body>, full of
    // Next's streamed nodes — the banner got appended at the very bottom of the
    // page instead of the top. An empty div collapses to zero height.
    if (!suggested) return <div />

    const i18n = getTranslations(suggested)

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, '1')
        } catch {
            // non-fatal: the banner reappears next visit
        }
        setSuggested(null)
    }

    return (
        // Horizontal padding leaves room for the absolutely-positioned dismiss
        // button, so long copy can't run underneath it.
        <div
            lang={suggested}
            className="relative border-b border-n-1 bg-primary-1/20 px-10 py-2 text-center text-sm text-n-1"
        >
            <span>
                {i18n.localeSuggestionText}{' '}
                <Link
                    href={localeHref(pathname, suggested)}
                    hrefLang={suggested}
                    onClick={() => persistLocale(toAppLocale(suggested))}
                    className="font-bold underline underline-offset-2"
                >
                    {i18n.localeSuggestionCta}
                </Link>
            </span>
            <button
                type="button"
                onClick={dismiss}
                aria-label={i18n.localeSuggestionDismiss}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-1 leading-none opacity-60 hover:opacity-100"
            >
                <span aria-hidden>×</span>
            </button>
        </div>
    )
}
