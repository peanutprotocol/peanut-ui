import { balanceBucket } from '../addMoneyPill.utils'

const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000))

describe('balanceBucket', () => {
    it('buckets the balance from zero up past $1000', () => {
        expect(balanceBucket(0n)).toBe('0')
        expect(balanceBucket(usd(0.17))).toBe('<1')
        expect(balanceBucket(usd(1))).toBe('1-10')
        expect(balanceBucket(usd(9.99))).toBe('1-10')
        expect(balanceBucket(usd(10))).toBe('10-100')
        expect(balanceBucket(usd(99.99))).toBe('10-100')
        expect(balanceBucket(usd(100))).toBe('100-1000')
        expect(balanceBucket(usd(1000))).toBe('1000+')
        expect(balanceBucket(usd(250_000))).toBe('1000+')
    })
})
