import { BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME, resolveBridgeAccountHolderName } from '../payment.consts'

describe('resolveBridgeAccountHolderName', () => {
    it('falls back to the current entity when Bridge omits the name (faster_payments/GBP)', () => {
        expect(resolveBridgeAccountHolderName(undefined)).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
        expect(resolveBridgeAccountHolderName(null)).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
        expect(resolveBridgeAccountHolderName('')).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
    })

    it('maps the stale legacy entity name to the current one, across spacing/case variants', () => {
        expect(resolveBridgeAccountHolderName('Bridge Building Sp. Z.o.o.')).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
        expect(resolveBridgeAccountHolderName('Bridge Building Sp.z.o.o.')).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
        expect(resolveBridgeAccountHolderName('BRIDGE BUILDING SP. Z.O.O.')).toBe(BRIDGE_DEFAULT_ACCOUNT_HOLDER_NAME)
    })

    it('passes through any other name Bridge returns (including the already-current one)', () => {
        expect(resolveBridgeAccountHolderName('Bridge Building S.A.')).toBe('Bridge Building S.A.')
        expect(resolveBridgeAccountHolderName('Some Other Entity')).toBe('Some Other Entity')
    })
})
