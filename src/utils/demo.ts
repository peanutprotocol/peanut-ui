export const DEMO_USERNAME = 'demo'
const DEMO_MODE_KEY = 'peanut_demo_mode'

// In-memory flag — the source of truth within a running session. Demo entry uses a
// SOFT navigation (no reload), so this survives and is readable synchronously on the
// very first render, immune to the localStorage-not-ready-yet race that defeats a
// hard nav. localStorage persists the flag across cold relaunches.
let demoSessionActive = false

export function isDemoUsername(username: string | null | undefined): boolean {
    return username?.trim().toLowerCase() === DEMO_USERNAME
}

export function enableDemoMode(): void {
    demoSessionActive = true
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(DEMO_MODE_KEY, 'true')
    } catch {}
}

export function disableDemoMode(): void {
    demoSessionActive = false
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(DEMO_MODE_KEY)
    } catch {}
}

// Explicit demo session on web and native: pre-filled data, KYC skipped, transactions simulated.
export function isDemoMode(): boolean {
    if (typeof window === 'undefined') return false
    if (demoSessionActive) return true
    try {
        return window.localStorage.getItem(DEMO_MODE_KEY) === 'true'
    } catch {
        return false
    }
}
