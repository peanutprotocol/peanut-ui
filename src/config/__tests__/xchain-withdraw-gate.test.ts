/**
 * Cross-chain withdraw is a single cross-platform switch (TASK-22250).
 *
 * It used to OR the ops kill-switch with `isIOSNative()`, so the withdraw token
 * selector locked to USDC on Arbitrum inside the iOS app while web and Android
 * offered every supported destination. That gate was added for one App Store
 * review and outlived it. This suite pins the value to the platform: reading it
 * on iOS, Android or web must give the same answer, so re-introducing a
 * platform condition fails here instead of silently shipping in a store build.
 *
 * The real `@/utils/capacitor` is used, not a mock — the point is that the
 * config no longer varies with what platform detection reports.
 */
const NATIVE_BRIDGE = { isNativePlatform: () => true }

const readGate = (): boolean => {
    jest.resetModules()
    return require('../underMaintenance.config').default.disableXchainWithdraw
}

describe('disableXchainWithdraw', () => {
    afterEach(() => {
        delete window.Capacitor
    })

    it.each([
        ['web', undefined],
        ['the iOS app', { ...NATIVE_BRIDGE, getPlatform: () => 'ios' }],
        ['the Android app', { ...NATIVE_BRIDGE, getPlatform: () => 'android' }],
    ])('is off on %s, so every supported destination is selectable', (_platform, capacitor) => {
        if (capacitor) window.Capacitor = capacitor
        expect(readGate()).toBe(false)
    })

    it('is a plain value, so the ops kill-switch is the one line to flip', () => {
        jest.resetModules()
        const config = require('../underMaintenance.config').default
        expect(Object.getOwnPropertyDescriptor(config, 'disableXchainWithdraw')).toMatchObject({ value: false })
    })
})
