'use client'

// Client-side gate around the landing page tree. On Capacitor (native app)
// builds, redirects to /home or /setup and renders nothing. On web, renders
// the children unchanged.
//
// Split out so the parent route can be a server component (reads landing
// singleton via fs) while the Capacitor branch stays client-only.

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '@/utils/auth-token'
import { isCapacitor } from '@/utils/capacitor'
import { isDemoMode } from '@/utils/demo'

export function LandingPageCapacitorGate({ children }: { children: ReactNode }) {
    const router = useRouter()

    useEffect(() => {
        if (isCapacitor()) {
            // Demo mode has no auth token but is a valid session — send it to the app.
            const token = getAuthToken()
            router.replace(token || isDemoMode() ? '/home' : '/setup')
        }
    }, [router])

    if (isCapacitor()) return null
    return <>{children}</>
}
