'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Post-setup iOS PWA-install wall (ForceIOSPWAInstall). Armed by the /setup
 * layout, read by the (mobile-ui) layout after the flow completes — the two
 * route groups have separate layouts, so this cross-layout latch lives in
 * sessionStorage (it used to be a field on the redux setup slice; the slice
 * is gone — TASK-21460). Session-scoped on purpose: a fresh visit re-derives
 * it, and a user who dismissed the wall stays past it for the session.
 */
const STORAGE_KEY = 'peanut.showIosPwaInstallScreen'

const listeners = new Set<() => void>()

function read(): boolean {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function write(value: boolean): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    } catch {
        // storage unavailable (private mode) — the wall simply never arms
    }
    listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function useIosPwaInstallGate(): {
    showIosPwaInstallScreen: boolean
    setShowIosPwaInstallScreen: (v: boolean) => void
} {
    const showIosPwaInstallScreen = useSyncExternalStore(subscribe, read, () => false)
    const setShowIosPwaInstallScreen = useCallback((value: boolean) => write(value), [])
    return { showIosPwaInstallScreen, setShowIosPwaInstallScreen }
}
