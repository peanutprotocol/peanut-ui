'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import { LOCALE_COOKIE, toAppLocale, toMarketingLocale } from '@/i18n/localeBridge'
import { persistLocale } from '@/i18n/app/locale-store'
import { type Locale } from '@/i18n/types'
import { Callout } from '@/components/0_Bruddle/Callout'
import { localeHref } from './LocaleSwitcher'

const DISMISS_KEY = 'locale-suggestion-dismissed'

// Inlined rather than read from the catalogs: this is a client component, and
// importing '@/i18n' would ship every locale's full catalog in the client
// bundle of each landing page for just these two strings. Keep in sync with
// the localeSuggestion* keys in src/i18n/{locale}.json. The dismiss label is
// no longer here — Callout owns its close button and labels it from the
// page's own catalog.
const STRINGS: Record<Locale, { text: string; cta: string }> = {
    en: { text: 'If you prefer to see this page in English,', cta: 'click here!' },
    'es-419': { text: 'Si prefieres ver esta página en español,', cta: '¡haz clic aquí!' },
    'es-ar': { text: 'Si preferís ver esta página en español,', cta: '¡hacé clic acá!' },
    'pt-br': { text: 'Se você prefere ver esta página em português,', cta: 'clique aqui!' },
}

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

    const i18n = STRINGS[suggested]

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, '1')
        } catch {
            // non-fatal: the banner reappears next visit
        }
        setSuggested(null)
    }

    return (
        // lang rides the wrapper, not the Callout: the banner speaks the
        // SUGGESTED language while the page around it does not.
        <div lang={suggested}>
            {/* square corners only: the compact inline anatomy is a borderless tint
                (ruled 2026-09-03), and this one runs edge to edge. */}
            <Callout priority="info" onDismiss={dismiss} className="rounded-none">
                {i18n.text}{' '}
                <Link
                    href={localeHref(pathname, suggested)}
                    hrefLang={suggested}
                    onClick={() => persistLocale(toAppLocale(suggested))}
                    className="underline underline-offset-2"
                >
                    {i18n.cta}
                </Link>
            </Callout>
        </div>
    )
}
