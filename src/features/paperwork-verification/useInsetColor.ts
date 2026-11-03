'use client'

import { useLayoutEffect } from 'react'
import { isCapacitor } from '@/utils/capacitor'

let queuedStatusBar: string | null = null

/** A color token as the literal the native API takes. */
const tokenHex = (token: string) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    return /^#[\da-f]{6}$/i.test(value) ? value : null
}

/**
 * Below Android 15 the OS paints the status bar. One screen's cleanup and the
 * next screen's paint land in the same commit, so the last color queued wins.
 */
export function paintNativeStatusBar(color: string) {
    if (!isCapacitor()) return
    const queued = queuedStatusBar !== null
    queuedStatusBar = color
    if (queued) return
    queueMicrotask(() => {
        const next = queuedStatusBar ?? color
        queuedStatusBar = null
        void import('@capacitor/status-bar')
            .then(({ StatusBar }) => StatusBar.setBackgroundColor({ color: next }))
            .catch(() => {})
    })
}

/** Back to useNativePlugins' strip, the page background, for the rest of the app. */
export function restoreNativeStatusBar() {
    const hex = tokenHex('--color-background-page')
    if (hex) paintNativeStatusBar(hex)
}

/** Paints the status-bar strip the way the setup flow does: white over questions, blue over a hero. */
export function useInsetColor(hero: boolean) {
    useLayoutEffect(() => {
        const token = hero ? '--color-background-setup-hero' : '--color-background-default'
        document.documentElement.style.setProperty('--setup-hero-background', `var(${token})`)
        const hex = tokenHex(token)
        if (hex) paintNativeStatusBar(hex)
        return () => {
            document.documentElement.style.removeProperty('--setup-hero-background')
            restoreNativeStatusBar()
        }
    }, [hero])
}
