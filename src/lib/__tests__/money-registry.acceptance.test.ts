import registry from '@/constants/token-details.json'
import { convertDecimalAmount, createMoney, isMoneyUnit, parseFiniteNumber, parsePositiveRate } from '@/lib/money'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

// TASK-24355 compatibility: validation cannot exclude already-supported assets.
const symbols = [...new Set(registry.flatMap((chain) => chain.tokens.map((token) => token.symbol)))]

describe('supported registry asset identifiers', () => {
    test.each(symbols)('retains supported symbol %s', (symbol) => {
        expect(isMoneyUnit(symbol)).toBe(true)
        expect(createMoney('1', symbol, 6)?.minorUnits).toBe(1_000_000n)
    })

    test.each(['', ' ', 'USD/USDC', 'US\nD', 'USD\u0000', 'A', '1USD', 'US-D'])(
        'rejects malformed identifier %s',
        (symbol) => {
            expect(isMoneyUnit(symbol)).toBe(false)
            expect(createMoney('1', symbol, 6)).toBeNull()
        }
    )
})

describe('bounded raw numeric work', () => {
    it('accepts at the 1024-character raw budget without changing the amount', () => {
        const raw = '0'.repeat(1023) + '1'
        expect(parseFiniteNumber(raw)).toBe(1)
        expect(parsePositiveRate(raw)).toBe(1)
        expect(createMoney(raw, 'USD', 2)?.minorUnits).toBe(100n)
        expect(convertDecimalAmount(raw, 1, 1, 2)).toBe('1')
    })

    it('rejects a one-character excess before numeric parsing and bigint work', () => {
        const raw = '0'.repeat(1024) + '1'
        expect(parseFiniteNumber(raw)).toBeNull()
        expect(parsePositiveRate(raw)).toBeNull()
        expect(createMoney(raw, 'USD', 2)).toBeNull()
        expect(convertDecimalAmount(raw, 1, 1, 2)).toBeNull()
        expect(createMoney('1.' + '0'.repeat(1024), 'USD', 2)).toBeNull()
    })
})
