'use client'

// Client-side gate around the landing page tree. On Capacitor (native app)
// builds, redirects to /home or /setup and renders nothing. On web, renders
// the children unchanged.
//
// Split out so the parent route can be a server component (reads landing
// singleton via fs) while the Capacitor branch stays client-only.

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { hasNativeSessionCookie } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'
import { isDemoMode } from '@/utils/demo'

export function LandingPageCapacitorGate({ children }: { children: ReactNode }) {
    const router = useRouter()

    useEffect(() => {
        if (isCapacitor()) {
            // Demo mode has no session but is valid — send it to the app.
            if (isDemoMode()) {
                router.replace('/home')
                return
            }
            // The session lives in the native cookie jar (async read). /home's
            // layout still validates via /users/me and bounces dead sessions.
            hasNativeSessionCookie().then((hasSession) => {
                router.replace(hasSession ? '/home' : '/setup')
            })
        }
    }, [router])

    if (isCapacitor()) return null
    return <>{children}</>
}
