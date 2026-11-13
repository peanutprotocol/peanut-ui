import { getNativeRpId } from '@/utils/capacitor'
import { nativeCapability } from '@/utils/native-capability'

type Availability = 'available' | 'unavailable' | 'unknown'

const passkeyAvailability = nativeCapability<{
    check(options: { rpId: string }): Promise<{ availability: Availability }>
}>('PasskeyAvailability', { platforms: ['android'] })

export async function checkAndroidLandingPasskey(signal: AbortSignal): Promise<Availability> {
    if (signal.aborted) return 'unknown'
    const result = await passkeyAvailability.call('check', { rpId: getNativeRpId() }, () => ({
        availability: 'unknown',
    }))
    if (signal.aborted) return 'unknown'
    const availability = result?.availability
    return availability === 'available' || availability === 'unavailable' ? availability : 'unknown'
}
