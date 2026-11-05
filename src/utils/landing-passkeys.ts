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

/**
 * Frees the native iOS slot held by the automatic login, so the manual login that
 * follows is not refused as "already in progress". The binary that reports
 * `immediateLogin` also implements this; any failure leaves the slot as it was.
 */
export async function cancelIOSImmediateLogin(): Promise<void> {
    try {
        const { CapacitorPasskey } = await import('@capgo/capacitor-passkey')
        await CapacitorPasskey.cancelRequest({ requestId: 'landing-immediate-login' })
    } catch {
        // Nothing pending, or an older binary without the method.
    }
}

export async function supportsIOSImmediateLogin(): Promise<boolean> {
    const { CapacitorPasskey } = await import('@capgo/capacitor-passkey')
    const configuration = await CapacitorPasskey.getConfiguration()
    return configuration.platform === 'ios' && configuration.immediateLogin === true
}
