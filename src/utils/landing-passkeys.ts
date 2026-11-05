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

export async function supportsIOSImmediateLogin(): Promise<boolean> {
    const { CapacitorPasskey } = await import('@capgo/capacitor-passkey')
    const configuration = await CapacitorPasskey.getConfiguration()
    return configuration.platform === 'ios' && configuration.immediateLogin === true
}
