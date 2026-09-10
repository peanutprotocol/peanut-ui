'use client'

// Client-side gate around the landing page tree. On Capacitor (native app)
// builds, redirects to /home or /setup and renders nothing. On web, renders
// the children unchanged.
//
// Split out so the parent route can be a server component (reads landing
// singleton via fs) while the Capacitor branch stays client-only.

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { hasNativeSession } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'
import { hasDeepLinkNavigated } from '@/utils/deep-link-state'
import { isDemoMode } from '@/utils/demo'

export function LandingPageCapacitorGate({ children }: { children: ReactNode }) {
    const router = useRouter()

    useEffect(() => {
        if (isCapacitor()) {
            // A deep link already navigated this boot — replacing to /home now
            // would discard that pending push and eat the tap (a cold-start App
            // Link races this gate on both platforms).
            if (hasDeepLinkNavigated()) return
            // Demo mode has no session but is valid — send it to the app.
            if (isDemoMode()) {
                router.replace('/home')
                return
            }
            // The session lives in native Preferences (async read, with a
            // legacy cookie-jar fallback). /home's layout still validates via
            // /users/me and bounces dead sessions.
            hasNativeSession().then((hasSession) => {
                if (hasDeepLinkNavigated()) return
                router.replace(hasSession ? '/home' : '/setup')
            })
        }
    }, [router])

    if (isCapacitor()) return null
    return <>{children}</>
}
