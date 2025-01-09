import { formatAmount } from '../general.utils'

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
})
