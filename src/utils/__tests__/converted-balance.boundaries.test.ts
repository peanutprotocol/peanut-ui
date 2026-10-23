import { convertedAccountTotal, displayAccountUnits } from '@/utils/converted-balance'

it.each([undefined, null, 1, [], {}, true, ' 1', '1 ', '0.000000000000000000', '1.0000000000000000001'])(
    'rejects malformed or nonpositive rates without throwing: %p',
    (rate) => {
        expect(convertedAccountTotal(1n, 1n, rate)).toBeUndefined()
    }
)

it('never accepts negative balances', () => {
    expect(convertedAccountTotal(-1n, 1n, '1')).toBeUndefined()
    expect(convertedAccountTotal(1n, -1n, '1')).toBeUndefined()
})

it('bounds truncated valuations within one token unit and displays no rounded-up cent (seed 0x45555243)', () => {
    let seed = 0x45555243
    const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return BigInt(seed)
    }
    for (let i = 0; i < 256; i++) {
        const selected = next() * next()
        const other = next() * next()
        const rateUnits = next() + 1n
        const rate = `${rateUnits / 1_000_000_000n}.${(rateUnits % 1_000_000_000n).toString().padStart(9, '0')}`
        const total = convertedAccountTotal(selected, other, rate)!
        const remainder = other * rateUnits - (total - selected) * 1_000_000_000n
        expect(total).toBeGreaterThanOrEqual(selected)
        expect(remainder).toBeGreaterThanOrEqual(0n)
        expect(remainder).toBeLessThan(1_000_000_000n)
        const [whole, cents] = displayAccountUnits(total).split('.')
        const displayed = BigInt(whole) * 1_000_000n + BigInt(cents) * 10_000n
        expect(displayed).toBeLessThanOrEqual(total)
        expect(total - displayed).toBeLessThan(10_000n)
    }
})
