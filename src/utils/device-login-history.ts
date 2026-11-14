import { isReturningDevice } from '@/utils/returning-device'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

export const HAS_LOGGED_IN_ON_DEVICE_KEY = 'peanut-has-logged-in-on-device'

// Devices signed out before the marker existed still hold the account record isReturningDevice reads.
export function hasLoggedInOnDevice(): boolean {
    return readStoredValue(HAS_LOGGED_IN_ON_DEVICE_KEY) === 'true' || isReturningDevice()
}

export function markLoggedInOnDevice(): void {
    writeStoredValue(HAS_LOGGED_IN_ON_DEVICE_KEY, 'true')
}
