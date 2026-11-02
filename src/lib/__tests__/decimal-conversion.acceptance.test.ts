import { convertDecimalAmount } from '@/lib/money'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

describe('exact decimal rational conversion', () => {
    it('preserves an integral identity conversion without float drift', () => {
        expect(convertDecimalAmount('4001', 1, 1, 2)).toBe('4001')
    })

    it('preserves the exact decimal round trip for a subcent conversion', () => {
        const outward = convertDecimalAmount('0.05', 0.18, 1, 18)
        expect(outward).toMatch(/^0\.0090*$/)
        expect(convertDecimalAmount(outward!, 1, 0.18, 18)).toMatch(/^0\.050*$/)
    })

    it('floors or rounds up using exact target decimal units', () => {
        expect(convertDecimalAmount('13.336891', 1, 1, 2)).toBe('13.33')
        expect(convertDecimalAmount('13.336891', 1, 1, 2, true)).toBe('13.34')
        expect(convertDecimalAmount('13.33', 1, 1, 2, true)).toBe('13.33')
        expect(convertDecimalAmount('0.009', 1, 1, 2)).toMatch(/^0(?:\.0+)?$/)
        expect(convertDecimalAmount('0.009', 1, 1, 2, true)).toBe('0.01')
    })

    it('supports finite numeric exponent rates without accepting exponent raw input', () => {
        expect(convertDecimalAmount('1', 1e-18, 1, 18)).toBe('0.000000000000000001')
        expect(convertDecimalAmount('1e3', 1, 1, 2)).toBeNull()
    })

    it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid rate %s in either direction', (rate) => {
        expect(convertDecimalAmount('1', rate, 1, 2)).toBeNull()
        expect(convertDecimalAmount('1', 1, rate, 2)).toBeNull()
    })

    it.each(['', ' ', 'NaN', 'Infinity', '1x', '1,000', '-1', '1.2.3'])('rejects invalid raw %s', (raw) => {
        expect(convertDecimalAmount(raw, 1, 1, 2)).toBeNull()
    })

    it.each([-1, 37, 1.5, NaN, Infinity])('rejects invalid decimals %s', (decimals) => {
        expect(convertDecimalAmount('1', 1, 1, decimals)).toBeNull()
    })

    it('enforces the uint256 result boundary including rounding up overflow', () => {
        const maximum = (1n << 256n) - 1n
        expect(convertDecimalAmount(maximum.toString(), 1, 1, 0)).toBe(maximum.toString())
        expect(convertDecimalAmount(maximum.toString(), 2, 1, 0)).toBeNull()
        expect(convertDecimalAmount(`${maximum}.1`, 1, 1, 0, true)).toBeNull()
        expect(convertDecimalAmount('9'.repeat(400), 1, 1, 0)).toBeNull()
        expect(convertDecimalAmount('1', Number.MAX_VALUE, Number.MIN_VALUE, 0)).toBeNull()
    })

    it('matches an independent integer floor/ceiling oracle over 128 cases (seed 24355)', () => {
        let seed = 24355
        for (let index = 0; index < 128; index++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            const whole = BigInt(seed % 100000)
            const numerator = whole * 7n * 100n
            const denominator = 13n
            const floor = numerator / denominator
            const ceiling = (numerator + denominator - 1n) / denominator
            for (const [roundUp, expected] of [
                [false, floor],
                [true, ceiling],
            ] as const) {
                const result = convertDecimalAmount(whole.toString(), 7, 13, 2, roundUp)
                expect(result).toMatch(/^\d+(?:\.\d{1,2})?$/)
                const [integer, fraction = ''] = result!.split('.')
                expect(BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'))).toBe(expected)
            }
        }
    })
})
