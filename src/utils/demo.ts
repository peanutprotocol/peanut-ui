import { toInviteCode } from '@/utils/general.utils'
import { isCapacitor } from '@/utils/capacitor'

export const DEMO_INVITE_CODE = 'demo'
const DEMO_MODE_KEY = 'peanut_demo_mode'

export function isDemoInviteCode(code: string | null | undefined): boolean {
    return !!code && toInviteCode(code) === DEMO_INVITE_CODE
}

export function enableDemoMode(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(DEMO_MODE_KEY, 'true')
    } catch {}
}

export function disableDemoMode(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(DEMO_MODE_KEY)
    } catch {}
}

// Native-only app-store demo: pre-filled data, KYC skipped, transactions simulated.
export function isDemoMode(): boolean {
    if (typeof window === 'undefined' || !isCapacitor()) return false
    try {
        return window.localStorage.getItem(DEMO_MODE_KEY) === 'true'
    } catch {
        return false
    }
}
