import { AmountValidationError } from '@/lib/url-parser/errors'
import { parseAmountAndToken } from '@/lib/url-parser/parser'

describe('Amount and Token Parsing', () => {
    describe('parseAmountAndToken', () => {
        it('should parse amount with token', () => {
            expect(parseAmountAndToken('0.1usdc')).toEqual({ amount: '0.1', token: 'usdc' })
            expect(parseAmountAndToken('100eth')).toEqual({ amount: '100', token: 'eth' })
            expect(parseAmountAndToken('1.5pol')).toEqual({ amount: '1.5', token: 'pol' })
        })

        it('should parse amount without token', () => {
            expect(parseAmountAndToken('0.1')).toEqual({ amount: '0.1' })
            expect(parseAmountAndToken('100')).toEqual({ amount: '100' })
            expect(parseAmountAndToken('1.5')).toEqual({ amount: '1.5' })
        })

        it('should parse token without amount', () => {
            expect(parseAmountAndToken('usdc')).toEqual({ token: 'usdc' })
            expect(parseAmountAndToken('eth')).toEqual({ token: 'eth' })
        })

        it('should handle empty string', () => {
            expect(parseAmountAndToken('')).toEqual({})
            expect(parseAmountAndToken(' ')).toEqual({})
        })

        it('should convert tokens to lowercase', () => {
            expect(parseAmountAndToken('1USDC')).toEqual({ amount: '1', token: 'usdc' })
            expect(parseAmountAndToken('0.5ETH')).toEqual({ amount: '0.5', token: 'eth' })
        })

        it('should handle whitespace', () => {
            expect(parseAmountAndToken(' 1usdc ')).toEqual({ amount: '1', token: 'usdc' })
            expect(parseAmountAndToken(' 0.5eth ')).toEqual({ amount: '0.5', token: 'eth' })
        })

        it('should throw for invalid amount formats', () => {
            expect(() => parseAmountAndToken('abc123')).toThrow(AmountValidationError)
            expect(() => parseAmountAndToken('1.2.3usdc')).toThrow(AmountValidationError)
            expect(() => parseAmountAndToken('..5eth')).toThrow(AmountValidationError)
            expect(() => parseAmountAndToken('1.eth2')).toThrow(AmountValidationError)
        })

        it('should handle decimal amounts correctly', () => {
            expect(parseAmountAndToken('0.01usdc')).toEqual({ amount: '0.01', token: 'usdc' })
            expect(parseAmountAndToken('.5eth')).toEqual({ amount: '.5', token: 'eth' })
            expect(parseAmountAndToken('1.')).toEqual({ amount: '1.' })
        })
    })
})
