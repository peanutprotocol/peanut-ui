const mockIsIOSNative = jest.fn()

jest.mock('@/utils/capacitor', () => ({
    isIOSNative: () => mockIsIOSNative(),
}))

import underMaintenanceConfig from '../underMaintenance.config'

describe('iOS cross-chain withdraw gate', () => {
    beforeEach(() => {
        mockIsIOSNative.mockReset()
    })

    describe('disableXchainWithdraw', () => {
        it('is on inside the iOS app', () => {
            mockIsIOSNative.mockReturnValue(true)
            expect(underMaintenanceConfig.disableXchainWithdraw).toBe(true)
        })

        it('leaves web and Android untouched', () => {
            mockIsIOSNative.mockReturnValue(false)
            expect(underMaintenanceConfig.disableXchainWithdraw).toBe(false)
        })

        // The value has to track the platform at read time — a snapshot taken at
        // module scope would be false, because the Capacitor bridge isn't on
        // `window` yet when this module first evaluates.
        it('is re-read on every access, not frozen at import', () => {
            mockIsIOSNative.mockReturnValue(false)
            expect(underMaintenanceConfig.disableXchainWithdraw).toBe(false)
            mockIsIOSNative.mockReturnValue(true)
            expect(underMaintenanceConfig.disableXchainWithdraw).toBe(true)
        })
    })
})
