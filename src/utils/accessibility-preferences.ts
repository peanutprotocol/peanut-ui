export const ACCESSIBILITY_STORAGE_KEY = 'peanut_accessibility_v1'
export const ACCESSIBILITY_CHANGE_EVENT = 'peanut:accessibility-change'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export type MotionPreference = 'system' | 'on' | 'off'
export interface AccessibilityPreferences {
    motion: MotionPreference
    largerText: boolean
    highContrast: boolean
    simplifiedConfirmations: boolean
}

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
    motion: 'system',
    largerText: false,
    highContrast: false,
    simplifiedConfirmations: false,
}

let volatilePreferences: string | null = null
let storageWriteFailed = false

export function getAccessibilitySnapshot(): string | null {
    if (typeof window === 'undefined') return null
    if (storageWriteFailed) return volatilePreferences
    try {
        return window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)
    } catch {
        return volatilePreferences
    }
}

export function parseAccessibilityPreferences(raw: string | null): AccessibilityPreferences {
    try {
        const value = raw ? JSON.parse(raw) : null
        return {
            motion: value?.motion === 'on' || value?.motion === 'off' ? value.motion : 'system',
            largerText: value?.largerText === true,
            highContrast: value?.highContrast === true,
            simplifiedConfirmations: value?.simplifiedConfirmations === true,
        }
    } catch {
        return DEFAULT_ACCESSIBILITY
    }
}

export function prefersReducedMotion(): boolean {
    const { motion } = parseAccessibilityPreferences(getAccessibilitySnapshot())
    return (
        motion === 'on' ||
        (motion === 'system' && typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches)
    )
}

export function applyAccessibilityPreferences(): void {
    if (typeof document === 'undefined') return
    const preferences = parseAccessibilityPreferences(getAccessibilitySnapshot())
    const root = document.documentElement
    root.dataset.reducedMotion = String(prefersReducedMotion())
    root.dataset.largerText = String(preferences.largerText)
    root.dataset.highContrast = String(preferences.highContrast)
}

export function updateAccessibilityPreferences(update: Partial<AccessibilityPreferences>): void {
    const preferences = parseAccessibilityPreferences(getAccessibilitySnapshot())
    const next = JSON.stringify(parseAccessibilityPreferences(JSON.stringify({ ...preferences, ...update })))
    volatilePreferences = next
    try {
        window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, next)
        storageWriteFailed = false
    } catch {
        storageWriteFailed = true
        // Private/restricted storage still permits preferences for this session.
    }
    applyAccessibilityPreferences()
    window.dispatchEvent(new Event(ACCESSIBILITY_CHANGE_EVENT))
}

export function subscribeAccessibility(listener: () => void): () => void {
    const media = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : null
    const changed = () => {
        applyAccessibilityPreferences()
        listener()
    }
    const storageChanged = (event: StorageEvent) => {
        if (event.key === null || event.key === ACCESSIBILITY_STORAGE_KEY) {
            storageWriteFailed = false
            changed()
        }
    }
    window.addEventListener(ACCESSIBILITY_CHANGE_EVENT, changed)
    window.addEventListener('storage', storageChanged)
    media?.addEventListener('change', changed)
    return () => {
        window.removeEventListener(ACCESSIBILITY_CHANGE_EVENT, changed)
        window.removeEventListener('storage', storageChanged)
        media?.removeEventListener('change', changed)
    }
}
