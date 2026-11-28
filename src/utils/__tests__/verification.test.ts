import { type RailCapability } from '@/types/capabilities'
import { canUseBankRail } from '../verification'

/**
 * QA 2026-09-24 (QA-12): a verified user who is not Brazilian holds the Pix
 * rail at pool tier — `pay` on, `deposit` and `withdraw` waiting on a full
 * account. Reading `deposit` for every flow told them Pix was closed while
 * they could pay any Pix key.
 */
describe('canUseBankRail reads the operation the flow runs', () => {
    const pixRail = (operations: RailCapability['operations']): RailCapability => ({
        id: 'manteca.pix_br',
        provider: 'manteca',
        method: 'PIX_BR',
        channel: 'bank',
        country: 'BR',
        currency: 'BRL',
        status: 'enabled',
        operations,
    })
    const poolTier = [pixRail({ pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' })]
    const fullTier = [pixRail({ pay: 'enabled', deposit: 'enabled', withdraw: 'enabled' })]

    it('pool tier: paying a Pix key is open, adding and own-account withdraw are not', () => {
        expect(canUseBankRail(poolTier, 'pay', 'BR')).toBe(true)
        expect(canUseBankRail(poolTier, 'deposit', 'BR')).toBe(false)
        expect(canUseBankRail(poolTier, 'withdraw', 'BR')).toBe(false)
    })

    it('full tier: every operation is open', () => {
        for (const op of ['pay', 'deposit', 'withdraw'] as const) {
            expect(canUseBankRail(fullTier, op, 'br')).toBe(true)
        }
    })

    it('a rail with no per-operation split answers every operation with its status', () => {
        const arRail: RailCapability = {
            ...pixRail(undefined),
            id: 'manteca.bank_transfer_ar',
            country: 'AR',
            currency: 'ARS',
        }
        expect(canUseBankRail([arRail], 'withdraw', 'AR')).toBe(true)
        expect(canUseBankRail([{ ...arRail, status: 'pending' }], 'withdraw', 'AR')).toBe(false)
    })

    it("another country's rail never answers for this one", () => {
        expect(canUseBankRail(fullTier, 'withdraw', 'AR')).toBe(false)
    })
})
