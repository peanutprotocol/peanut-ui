import { hasKnownDeviceCredentials } from '@/components/Setup/setup-entry'
import { USER_PREFERENCES_KEY_SUFFIX } from '@/constants/auth.consts'

const DEVICE_HAD_ACCOUNT_KEY = 'peanut-device-had-account'

export function markDeviceHadAccount(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(DEVICE_HAD_ACCOUNT_KEY, '1')
    } catch {}
}

// Login writes a `<userId>:user-preferences` record that logout keeps, so it also covers devices signed out before the marker existed.
function hasStoredAccountRecord(): boolean {
    try {
        const storage = window.localStorage
        if (storage.getItem(DEVICE_HAD_ACCOUNT_KEY) === '1') return true
        for (let index = 0; index < storage.length; index++) {
            if (storage.key(index)?.endsWith(USER_PREFERENCES_KEY_SUFFIX)) return true
        }
    } catch {}
    return false
}

export function isReturningDevice(): boolean {
    if (typeof window === 'undefined') return false
    if (hasStoredAccountRecord()) return true
    try {
        return hasKnownDeviceCredentials()
    } catch {
        return false
    }
}
