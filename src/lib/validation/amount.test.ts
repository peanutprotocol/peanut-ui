import { AmountValidationError } from '@/lib/url-parser/errors'
import { validateAmount } from '@/lib/validation/amount'

describe('Amount Validation', () => {
    describe('validateAmount', () => {
        it('should validate positive integers', () => {
            expect(validateAmount('100')).toEqual({ amount: '100' })
            expect(validateAmount('1')).toEqual({ amount: '1' })
            expect(validateAmount('999999')).toEqual({ amount: '999999' })
        })

        it('should validate decimal numbers', () => {
            expect(validateAmount('0.1')).toEqual({ amount: '0.1' })
            expect(validateAmount('1.5')).toEqual({ amount: '1.5' })
            expect(validateAmount('100.55')).toEqual({ amount: '100.55' })
            expect(validateAmount('.5')).toEqual({ amount: '.5' })
        })

        it('should throw for zero amount', () => {
            expect(() => validateAmount('0')).toThrow(AmountValidationError)
            expect(() => validateAmount('0.0')).toThrow(AmountValidationError)
            expect(() => validateAmount('0.00')).toThrow(AmountValidationError)
        })

        it('should throw for negative numbers', () => {
            expect(() => validateAmount('-1')).toThrow(AmountValidationError)
            expect(() => validateAmount('-0.1')).toThrow(AmountValidationError)
            expect(() => validateAmount('-100')).toThrow(AmountValidationError)
        })

        it('should handle empty string', () => {
            expect(validateAmount('')).toEqual({ amount: '' })
            expect(validateAmount(' ')).toEqual({ amount: '' })
        })

        it('should throw for invalid number formats', () => {
            expect(() => validateAmount('abc')).toThrow(AmountValidationError)
            expect(() => validateAmount('1.2.3')).toThrow(AmountValidationError)
            expect(() => validateAmount('1,000')).toThrow(AmountValidationError)
            expect(() => validateAmount('1e5')).toThrow(AmountValidationError)
        })

        it('should handle edge cases', () => {
            expect(validateAmount('0.00000001')).toEqual({ amount: '0.00000001' })
            expect(validateAmount('999999999.999999999')).toEqual({ amount: '999999999.999999999' })
        })
    })
})
