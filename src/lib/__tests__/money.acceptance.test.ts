import { checkedConversion, createMoney, parseFiniteNumber, parsePositiveRate, requirePaymentMoney } from '@/lib/money'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

const invalid = [
    undefined,
    null,
    '',
    ' ',
    '\n',
    true,
    false,
    {},
    [],
    [1],
    NaN,
    Infinity,
    -Infinity,
    'NaN',
    'Infinity',
    '-Infinity',
    '12usd',
    '1,000',
    '1e3',
    '0x10',
    '--1',
    '1.2.3',
    '9'.repeat(400),
]

describe('strict finite numeric boundary', () => {
    it.each(invalid.map((value, index) => ({ value, index })))('rejects invalid corpus case $index', ({ value }) => {
        expect(parseFiniteNumber(value)).toBeNull()
        expect(parsePositiveRate(value)).toBeNull()
    })

    it.each([0, 1, -1, 0.125, Number.MAX_VALUE, Number.MIN_VALUE])('accepts finite numeric %s', (value) => {
        expect(parseFiniteNumber(value)).toBe(value)
    })

    it.each([
        ['0', 0],
        ['12.50', 12.5],
        ['-12.50', -12.5],
        ['+12.50', 12.5],
    ] as const)('accepts signed plain decimal %s', (raw, expected) => expect(parseFiniteNumber(raw)).toBe(expected))

    it('requires a strictly positive rate', () => {
        for (const value of [0, -0, -1, '0', '-0', '-1.25']) expect(parsePositiveRate(value)).toBeNull()
        for (const value of [1, '1.25', Number.MIN_VALUE]) expect(parsePositiveRate(value)).toBe(Number(value))
    })
})

describe('exact money boundary', () => {
    it('accepts the supported bridged asset symbol USDC.e and bounded asset suffixes', () => {
        expect(createMoney('1.25', 'USDC.e', 6)).toEqual({
            amount: '1.25',
            currency: 'USDC.e',
            decimals: 6,
            minorUnits: 1250000n,
        })
        expect(createMoney('1', `${'A'.repeat(12)}.${'b'.repeat(8)}`, 0)?.minorUnits).toBe(1n)
        for (const currency of [
            'USDC.',
            '.USDC',
            'USDC.e.x',
            'USDC.e-',
            `USDC.${'a'.repeat(9)}`,
            `${'A'.repeat(13)}.e`,
        ]) {
            expect(createMoney('1', currency, 6)).toBeNull()
        }
    })

    it('preserves exact minor units beyond JavaScript integer precision', () => {
        expect(createMoney('9007199254740993.01', 'USD', 2)).toEqual({
            amount: '9007199254740993.01',
            currency: 'USD',
            decimals: 2,
            minorUnits: 900719925474099301n,
        })
    })

    it('accepts zero and the full precision boundary', () => {
        expect(createMoney('0', 'USDC', 6)?.minorUnits).toBe(0n)
        expect(createMoney('0.' + '0'.repeat(35) + '1', 'ETH', 36)?.minorUnits).toBe(1n)
        expect(createMoney('12', 'usd', 0)?.minorUnits).toBe(12n)
    })

    it('accepts uint256 maximum and rejects one unit over it', () => {
        const maximum = (1n << 256n) - 1n
        expect(createMoney(maximum.toString(), 'ETH', 0)?.minorUnits).toBe(maximum)
        expect(createMoney((maximum + 1n).toString(), 'ETH', 0)).toBeNull()
        expect(createMoney(maximum.toString(), 'ETH', 1)).toBeNull()
    })

    it.each(invalid.map((value, index) => ({ value, index })))('rejects invalid money case $index', ({ value }) => {
        expect(createMoney(value, 'USD', 2)).toBeNull()
        expect(() => requirePaymentMoney(value, 'USD', 2)).toThrow(Error)
    })

    it.each(['-1', '-0.01', '0.001', '12.345'])('never rounds invalid money %s into payable money', (raw) => {
        expect(createMoney(raw, 'USD', 2)).toBeNull()
        expect(() => requirePaymentMoney(raw, 'USD', 2)).toThrow(Error)
    })

    it.each(['', 'A', '1USD', 'USD ', '$USD', 'US-D', 'A'.repeat(13)])('rejects invalid unit %s', (currency) => {
        expect(createMoney('1', currency, 2)).toBeNull()
        expect(() => requirePaymentMoney('1', currency, 2)).toThrow(Error)
    })

    it.each([-1, 37, 1.5, NaN, Infinity])('rejects invalid decimals %s', (decimals) => {
        expect(createMoney('1', 'USD', decimals)).toBeNull()
        expect(() => requirePaymentMoney('1', 'USD', decimals)).toThrow(Error)
    })

    it('requires a nonzero payment and returns exact validated money', () => {
        expect(() => requirePaymentMoney('0.00', 'USD', 2)).toThrow(Error)
        expect(requirePaymentMoney('0.01', 'USD', 2)).toEqual({
            amount: '0.01',
            currency: 'USD',
            decimals: 2,
            minorUnits: 1n,
        })
    })

    it('exercises 256 deterministic decimal cases against an independent integer oracle (seed 24355)', () => {
        let seed = 24355
        for (let index = 0; index < 256; index++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            const decimals = index % 37
            const minor = BigInt(seed)
            const digits = minor.toString().padStart(decimals + 1, '0')
            const raw = decimals === 0 ? digits : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
            const result = createMoney(raw, 'USDC', decimals)
            expect(result?.minorUnits).toBe(minor)
            expect(result?.amount).toMatch(/^\d+(?:\.\d+)?$/)
            expect(createMoney(`${raw}${decimals === 0 ? '.' : ''}1`, 'USDC', decimals)).toBeNull()
        }
    })
})

describe('checked conversion', () => {
    it('converts valid values and preserves zero', () => {
        expect(checkedConversion('10', '2', '4')).toBe(5)
        expect(checkedConversion(0, 2, 4)).toBe(0)
    })

    it.each(invalid.map((value, index) => ({ value, index })))(
        'rejects malformed conversion case $index',
        ({ value }) => {
            expect(checkedConversion(value, 1, 1)).toBeNull()
            expect(checkedConversion(1, value, 1)).toBeNull()
            expect(checkedConversion(1, 1, value)).toBeNull()
        }
    )

    it('rejects negatives, zero rates and arithmetic overflow', () => {
        expect(checkedConversion(-1, 1, 1)).toBeNull()
        for (const rate of [0, -1]) {
            expect(checkedConversion(1, rate, 1)).toBeNull()
            expect(checkedConversion(1, 1, rate)).toBeNull()
        }
        expect(checkedConversion(Number.MAX_VALUE, 2, 1)).toBeNull()
        expect(checkedConversion(1, 1, Number.MIN_VALUE)).toBeNull()
    })
})
