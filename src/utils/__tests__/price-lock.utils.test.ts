import { type WithdrawPriceLock } from '@/services/manteca'
import { isLockExpired, receiveLock } from '../price-lock.utils'

const LOCK: WithdrawPriceLock = {
    priceLockCode: 'lock-1',
    price: '1300',
    // Manteca's clock: already past for a phone that runs fast
    expiresAt: '2026-09-24T12:00:00.000Z',
    usdAmount: '10',
    fiatAmount: '13000.00',
    currency: 'ars',
}
const RECEIVED_AT = Date.parse('2026-09-24T12:03:00.000Z')

describe('receiveLock', () => {
    it('counts the remaining time from when the answer arrived, not from expiresAt', () => {
        const lock = receiveLock({ ...LOCK, expiresInMs: 120_000 }, RECEIVED_AT)

        expect(isLockExpired(lock, RECEIVED_AT + 119_000)).toBe(false)
        expect(isLockExpired(lock, RECEIVED_AT + 120_000)).toBe(true)
    })

    it('without a remaining time there is no device deadline: the provider decides', () => {
        const lock = receiveLock(LOCK, RECEIVED_AT)

        expect(lock.deadline).toBeUndefined()
        expect(isLockExpired(lock, RECEIVED_AT + 10 * 60_000)).toBe(false)
    })
})
