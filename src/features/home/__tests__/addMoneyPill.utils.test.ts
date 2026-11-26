import { balanceBucket, showsAddMoneyPill } from '../addMoneyPill.utils'

const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000))
const eligible = { isVerified: true, balance: usd(3.2), isFetching: false, isStale: false }

describe('showsAddMoneyPill', () => {
    it('shows for a verified user with a loaded balance under $10', () => {
        expect(showsAddMoneyPill(eligible)).toBe(true)
        expect(showsAddMoneyPill({ ...eligible, balance: 0n })).toBe(true)
        expect(showsAddMoneyPill({ ...eligible, balance: usd(9.99) })).toBe(true)
    })

    it('keeps the round button at $10 or more', () => {
        expect(showsAddMoneyPill({ ...eligible, balance: usd(10) })).toBe(false)
        expect(showsAddMoneyPill({ ...eligible, balance: usd(250) })).toBe(false)
    })

    it('keeps the round button before verification', () => {
        expect(showsAddMoneyPill({ ...eligible, isVerified: false })).toBe(false)
    })

    it('keeps the round button while the balance is unknown, loading or stale', () => {
        expect(showsAddMoneyPill({ ...eligible, balance: undefined })).toBe(false)
        expect(showsAddMoneyPill({ ...eligible, isFetching: true })).toBe(false)
        expect(showsAddMoneyPill({ ...eligible, isStale: true })).toBe(false)
    })
})

describe('balanceBucket', () => {
    it('buckets the balance for analytics', () => {
        expect(balanceBucket(0n)).toBe('0')
        expect(balanceBucket(usd(0.17))).toBe('<1')
        expect(balanceBucket(usd(1))).toBe('1-10')
        expect(balanceBucket(usd(9.99))).toBe('1-10')
    })
})
