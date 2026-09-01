import { useSyncExternalStore } from 'react'
import { isCapacitor } from '@/utils/capacitor'

// Real display-mode detection, without the Capacitor short-circuit below —
// for analytics, where "built with the Capacitor env flag" must not read as
// PWA when the page is actually a plain browser tab.
export const isStandaloneDisplayMode = (): boolean => {
    if (typeof window === 'undefined') return false
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://') ||
        new URLSearchParams(window.location.search).get('mode') === 'pwa'
    )
}

const detectIsPWA = (): boolean => {
    if (typeof window === 'undefined') return false
    if (isCapacitor()) return true
    return isStandaloneDisplayMode()
}

// Cache the detection so multiple consumers share one read per page. The cache
// is invalidated inside subscribe() so a new consumer mounting after a
// mid-session install sees the current value.
let cached: boolean | null = null
const getSnapshot = (): boolean => (cached ??= detectIsPWA())
const getServerSnapshot = (): boolean => false

const subscribe = (notify: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {}
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = () => {
        cached = detectIsPWA()
        notify()
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
}

export const usePWAStatus = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
