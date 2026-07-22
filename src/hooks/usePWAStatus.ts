import { useSyncExternalStore } from 'react'
import { isCapacitor } from '@/utils/capacitor'

const detectIsPWA = (): boolean => {
    if (typeof window === 'undefined') return false
    if (isCapacitor()) return true
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://') ||
        window.location.href.includes('?mode=pwa')
    )
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
