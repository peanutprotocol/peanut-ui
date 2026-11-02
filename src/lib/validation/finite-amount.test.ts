import { AmountValidationError } from '@/lib/url-parser/errors'
import { validateAmount } from '@/lib/validation/amount'

describe('finite decimal amount validation', () => {
    test.each(['', '999', '1000', '4000', '10000', '.5', '0.01', '10000.01'])(
        'preserves valid raw decimal %s',
        (amount) => {
            expect(validateAmount(amount)).toEqual({ amount })
        }
    )

    test.each(['NaN', 'Infinity', '-Infinity', '1.2.3', '1..2', '..5', '9'.repeat(400), `${'9'.repeat(400)}.5`])(
        'rejects malformed or nonfinite amount %s',
        (amount) => {
            expect(() => validateAmount(amount)).toThrow(AmountValidationError)
        }
    )

    test('bounded deterministic overflow corpus cannot pass decimal validation', () => {
        // No random seed: 32 decimal-only inputs, lengths 309 through 340.
        for (let length = 309; length <= 340; length += 1) {
            expect(() => validateAmount('9'.repeat(length))).toThrow(AmountValidationError)
        }
    })
})
