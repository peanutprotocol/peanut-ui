'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { type Locale } from '@/i18n/types'

// Mirrors JWT_COOKIE_KEY in src/utils/auth-token.ts. Importing that module
// would drag the auth/capacitor machinery into every marketing page bundle
// for one cookie read; the name is frozen anyway — changing it logs out
// every web user.
const JWT_COOKIE_KEY = 'jwt-token'

// Inlined for the same reason as LocaleSuggestion's STRINGS: importing the
// catalogs would ship every locale's messages for one string.
const STRINGS: Record<Locale, string> = {
    en: 'Back to app',
    'es-419': 'Volver a la app',
    'es-ar': 'Volver a la app',
    'pt-br': 'Voltar ao app',
}

/**
 * Slim sticky bar shown to logged-in visitors on marketing/content pages.
 * Opening help or a landing page from inside the app drops all app chrome
 * (bottom nav, banner) — without a visible way back, users read it as being
 * stranded. The cookie is read after mount: these pages are SSG and the bar
 * must not be in the prerendered markup.
 */
export function BackToAppBar({ locale }: { locale: Locale }) {
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {
        setLoggedIn(Boolean(Cookies.get(JWT_COOKIE_KEY)))
    }, [])

    if (!loggedIn) return null

    return (
        <div className="sticky top-0 z-30 border-b border-n-1 bg-white">
            <Link
                href="/home"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-body-s font-semibold text-n-1"
            >
                <span aria-hidden>←</span>
                {STRINGS[locale]}
            </Link>
        </div>
    )
}
