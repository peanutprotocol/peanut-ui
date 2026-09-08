'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
    getAccessibilitySnapshot,
    parseAccessibilityPreferences,
    prefersReducedMotion,
    subscribeAccessibility,
    updateAccessibilityPreferences,
} from '@/utils/accessibility-preferences'

export function useAccessibility() {
    const raw = useSyncExternalStore(subscribeAccessibility, getAccessibilitySnapshot, () => null)
    const preferences = useMemo(() => parseAccessibilityPreferences(raw), [raw])
    return { ...preferences, updatePreferences: updateAccessibilityPreferences }
}

export function useReducedMotion(): boolean {
    return useSyncExternalStore(subscribeAccessibility, prefersReducedMotion, () => false)
}
