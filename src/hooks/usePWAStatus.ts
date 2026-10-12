import { useSyncExternalStore } from 'react'
import { isCapacitor } from '@/utils/capacitor'

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
