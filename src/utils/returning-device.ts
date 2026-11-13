import { hasKnownDeviceCredentials } from '@/components/Setup/setup-entry'

const DEVICE_HAD_ACCOUNT_KEY = 'peanut-device-had-account'

export function markDeviceHadAccount(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(DEVICE_HAD_ACCOUNT_KEY, '1')
    } catch {}
}

export function isReturningDevice(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return window.localStorage.getItem(DEVICE_HAD_ACCOUNT_KEY) === '1' || hasKnownDeviceCredentials()
    } catch {
        return false
    }
}
