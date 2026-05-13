import { useEffect, useState } from 'react'
import { isCapacitor } from '@/utils/capacitor'

// Initialize synchronously on the client so iOS PWA users don't briefly see the
// "Add to home screen" CTA before the effect resolves. SSR still gets `false`
// (no window); the hydration mismatch is the same one we'd have on any
// client-only signal and React reconciles after first paint.
const detectIsPWA = (): boolean => {
    if (typeof window === 'undefined') return false
    if (isCapacitor()) return true
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://') ||
        window.location.href.includes('?mode=pwa')
    )
}

// Cache the initial detection at module scope — several hooks consume usePWAStatus
// on a single page load (home, setup, brave-install, user query). Without this,
// each mount re-runs matchMedia + navigator + referrer reads.
let cachedInitial: boolean | null = null
const getInitial = () => (cachedInitial ??= detectIsPWA())

export const usePWAStatus = () => {
    const [isPWA, setIsPWA] = useState(getInitial)

    useEffect(() => {
        if (typeof window === 'undefined') return

        // Listen for changes in display mode (e.g. user installs PWA mid-session)
        const mediaQuery = window.matchMedia('(display-mode: standalone)')
        const handleChange = (e: MediaQueryListEvent) => setIsPWA(e.matches)

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    return isPWA
}
