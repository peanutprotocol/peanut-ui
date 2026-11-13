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
