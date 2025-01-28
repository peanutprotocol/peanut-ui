import { formatAmount, formatExtendedNumber } from '../general.utils'

describe('Amount Formatting Utilities', () => {
    describe('formatAmount', () => {
        describe('edge cases', () => {
            it('should handle empty string', () => {
                expect(formatAmount('')).toBe('0')
            })

            it('should handle invalid string input', () => {
                expect(formatAmount('invalid')).toBe('0')
            })

            it('should handle NaN', () => {
                expect(formatAmount(NaN)).toBe('0')
            })
        })

        describe('small numbers (< 0.01)', () => {
            it('should format to 2 significant digits', () => {
                expect(formatAmount(0.0012345)).toBe('0.0012')
                expect(formatAmount(0.00456)).toBe('0.0046')
                expect(formatAmount(0.000789)).toBe('0.00079')
            })

            it('should handle negative small numbers', () => {
                expect(formatAmount(-0.0012345)).toBe('-0.0012')
                expect(formatAmount(-0.00456)).toBe('-0.0046')
            })

            it('should handle string inputs of small numbers', () => {
                expect(formatAmount('0.0012345')).toBe('0.0012')
                expect(formatAmount('-0.00456')).toBe('-0.0046')
            })
        })

        describe('regular numbers (≥ 0.01)', () => {
            it('should format to at most 2 decimal places', () => {
                expect(formatAmount(1.23456)).toBe('1.23')
                expect(formatAmount(10.9876)).toBe('10.99')
                expect(formatAmount(0.01)).toBe('0.01')
            })

            it('should remove trailing zeros after decimal', () => {
                expect(formatAmount('1.230')).toBe('1.23')
                expect(formatAmount('1.200')).toBe('1.2')
                expect(formatAmount(10.5)).toBe('10.5')
            })

            it('should handle negative numbers', () => {
                expect(formatAmount(-1.23456)).toBe('-1.23')
                expect(formatAmount('-10.9876')).toBe('-10.99')
            })
        })

        describe('whole numbers', () => {
            it('should remove decimal part if all zeros', () => {
                expect(formatAmount('1000.00')).toBe('1000')
                expect(formatAmount(1.0)).toBe('1')
            })

            it('should handle zero', () => {
                expect(formatAmount(0)).toBe('0')
                expect(formatAmount('0.00')).toBe('0')
            })

            it('should handle string whole numbers', () => {
                expect(formatAmount('100')).toBe('100')
                expect(formatAmount('-1000')).toBe('-1000')
            })
        })
    })

    describe('formatExtendedNumber', () => {
        describe('edge cases', () => {
            it('should handle empty string', () => {
                expect(formatExtendedNumber('')).toBe('0')
            })

            it('should handle invalid string input', () => {
                expect(formatExtendedNumber('invalid')).toBe('0')
            })

            it('should handle NaN', () => {
                expect(formatExtendedNumber(NaN)).toBe('0')
            })

            it('should handle undefined and null', () => {
                expect(formatExtendedNumber(undefined as any)).toBe('0')
                expect(formatExtendedNumber(null as any)).toBe('0')
            })
        })

        describe('numbers with 6 or fewer digits', () => {
            it('should not apply suffix for numbers with 6 or fewer digits', () => {
                expect(formatExtendedNumber(12345)).toBe('12345')
                expect(formatExtendedNumber(999)).toBe('999')
                expect(formatExtendedNumber(1000)).toBe('1000')
                expect(formatExtendedNumber(999999)).toBe('999999')
            })

            it('should handle decimal numbers with 6 or fewer total digits', () => {
                expect(formatExtendedNumber(12.34)).toBe('12.34')
                expect(formatExtendedNumber(123.4)).toBe('123.4')
                expect(formatExtendedNumber(0.123)).toBe('0.12')
                expect(formatExtendedNumber(1234.5)).toBe('1234.5')
            })

            it('should handle negative numbers with 6 or fewer digits', () => {
                expect(formatExtendedNumber(-1234)).toBe('-1234')
                expect(formatExtendedNumber(-12.34)).toBe('-12.34')
                expect(formatExtendedNumber(-99999)).toBe('-99999')
            })

            it('should handle string inputs with 6 or fewer digits', () => {
                expect(formatExtendedNumber('12345')).toBe('12345')
                expect(formatExtendedNumber('-1234')).toBe('-1234')
                expect(formatExtendedNumber('999.99')).toBe('999.99')
            })
        })

        describe('numbers exceeding 6 digits', () => {
            it('should format whole numbers exceeding 6 digits', () => {
                expect(formatExtendedNumber(1234567)).toBe('1.23M')
                expect(formatExtendedNumber(9876543)).toBe('9.88M')
            })

            it('should format decimal numbers exceeding 6 total digits', () => {
                expect(formatExtendedNumber(1234.567)).toBe('1.23K')
                expect(formatExtendedNumber(12345.67)).toBe('12.35K')
            })

            it('should format negative numbers exceeding 6 digits', () => {
                expect(formatExtendedNumber(-1234567)).toBe('-1.23M')
                expect(formatExtendedNumber(-1234.567)).toBe('-1.23K')
            })
        })

        describe('suffix selection', () => {
            it('should apply K suffix for appropriate ranges', () => {
                expect(formatExtendedNumber(1234567)).toBe('1.23M')
                expect(formatExtendedNumber(1234.567)).toBe('1.23K')
            })

            it('should apply M suffix for appropriate ranges', () => {
                expect(formatExtendedNumber(12345678)).toBe('12.35M')
                expect(formatExtendedNumber(123456789)).toBe('123.46M')
            })

            it('should apply B suffix for appropriate ranges', () => {
                expect(formatExtendedNumber(1234567890)).toBe('1.23B')
                expect(formatExtendedNumber(12345678901)).toBe('12.35B')
            })

            it('should apply T suffix for appropriate ranges', () => {
                expect(formatExtendedNumber(1234567890000)).toBe('1.23T')
                expect(formatExtendedNumber(12345678900000)).toBe('12.35T')
            })
        })

        describe('boundary cases', () => {
            it('should handle numbers at the 6-digit boundary', () => {
                expect(formatExtendedNumber(999999)).toBe('999999')
                expect(formatExtendedNumber(1000000)).toBe('1M')
                expect(formatExtendedNumber(999.9999)).toBe('1000')
                expect(formatExtendedNumber(999.99999)).toBe('1000')
            })

            it('should handle numbers at suffix boundaries', () => {
                expect(formatExtendedNumber(999999.9)).toBe('1M')
                expect(formatExtendedNumber(999999999)).toBe('1B')
                expect(formatExtendedNumber(999999999999)).toBe('1T')
            })
        })
    })
})
