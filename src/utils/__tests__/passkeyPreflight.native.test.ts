/** @jest-environment jsdom */
const plugin: Record<string, jest.Mock | undefined> = {}
const openAppSettings = jest.fn()
jest.mock('@capgo/capacitor-passkey', () => ({ CapacitorPasskey: plugin }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => true,
    getNativeRpId: () => 'peanut.me',
    isAndroidNativeBridge: () => false,
}))
jest.mock('@/utils/native-settings', () => ({ openAppSettings: () => openAppSettings() }))

import { checkPasskeySupport, openPasskeySettings } from '../passkeyPreflight'

const setUserAgent = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })

beforeEach(() => {
    for (const key of Object.keys(plugin)) delete plugin[key]
    plugin.isSupported = jest.fn().mockResolvedValue({ available: true, conditionalMediation: false })
    openAppSettings.mockReset()
    setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-A146B) Chrome/120')
})

it('blocks with nativeScreenLock and the security-settings fix when the device has no screen lock', async () => {
    plugin.getReadiness = jest.fn().mockResolvedValue({ deviceSecure: false })
    expect(await checkPasskeySupport()).toMatchObject({
        isSupported: false,
        warningKey: 'nativeScreenLock',
        warning: 'preflight:nativeScreenLock',
        fix: 'security-settings',
    })
})

it('blocks with nativeNoProvider when the native side knows no provider can serve passkeys', async () => {
    plugin.getReadiness = jest.fn().mockResolvedValue({ deviceSecure: true, providerReady: false })
    const result = await checkPasskeySupport()
    expect(result).toMatchObject({ isSupported: false, warningKey: 'nativeNoProvider' })
    expect(result.fix).toBeUndefined()
})

it('passes a secure device whose provider readiness is unknown', async () => {
    plugin.getReadiness = jest.fn().mockResolvedValue({ deviceSecure: true })
    expect(await checkPasskeySupport()).toMatchObject({ isSupported: true, warningKey: null })
})

it.each([
    ['has no getReadiness in its JS', undefined],
    ['rejects getReadiness as unimplemented', jest.fn().mockRejectedValue(new Error('not implemented'))],
])('keeps the current behaviour when an old binary %s', async (_, getReadiness) => {
    plugin.getReadiness = getReadiness
    expect(await checkPasskeySupport()).toMatchObject({ isSupported: true, warningKey: null })
})

it('does not ask iOS for Android readiness', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    plugin.getReadiness = jest.fn().mockResolvedValue({ deviceSecure: false })
    expect(await checkPasskeySupport()).toMatchObject({ isSupported: true })
    expect(plugin.getReadiness).not.toHaveBeenCalled()
})

it('opens Security settings natively, and the app settings on a binary without the method', async () => {
    plugin.openSecuritySettings = jest.fn().mockResolvedValue(undefined)
    await openPasskeySettings()
    expect(plugin.openSecuritySettings).toHaveBeenCalledTimes(1)
    expect(openAppSettings).not.toHaveBeenCalled()

    plugin.openSecuritySettings = jest.fn().mockRejectedValue(new Error('not implemented'))
    await openPasskeySettings()
    expect(openAppSettings).toHaveBeenCalledTimes(1)
})
