import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

export const HAS_LOGGED_IN_ON_DEVICE_KEY = 'peanut-has-logged-in-on-device'

export function hasLoggedInOnDevice(): boolean {
    return readStoredValue(HAS_LOGGED_IN_ON_DEVICE_KEY) === 'true'
}

export function markLoggedInOnDevice(): void {
    writeStoredValue(HAS_LOGGED_IN_ON_DEVICE_KEY, 'true')
}
