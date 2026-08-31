'use client'

import { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'

// Mirrors JWT_COOKIE_KEY in src/utils/auth-token.ts. Importing that module
// would drag the auth/capacitor machinery into every marketing page bundle
// for one cookie read; the name is frozen anyway — changing it logs out
// every web user.
const JWT_COOKIE_KEY = 'jwt-token'

/**
 * The /shhhhh back affordance, applied to every marketing/content page: the
 * design-system NavHeader circle button overlaying the top-left of the hero.
 * Shown only to logged-in web visitors — opening help or a landing page from
 * inside the app drops all app chrome (bottom nav, banner), and without a
 * visible way back users read it as being stranded. The cookie is read after
 * mount: these pages are SSG and the button must not be in the prerendered
 * markup, so SEO pages stay untouched for logged-out visitors.
 */
export function BackToAppBar() {
    const [loggedIn, setLoggedIn] = useState(false)
    const onBack = useSafeBack('/home')

    useEffect(() => {
        setLoggedIn(Boolean(Cookies.get(JWT_COOKIE_KEY)))
    }, [])

    if (!loggedIn) return null

    return (
        <div className="absolute top-4 left-4 z-30">
            <NavHeader onPrev={onBack} hideLabel />
        </div>
    )
}
