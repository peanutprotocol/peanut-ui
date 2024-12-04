import { sanitizeBankAccount, formatBankAccountDisplay } from '../format.utils'

describe('Bank Account Formatting Utilities', () => {
    describe('sanitizeBankAccount', () => {
        it('should remove spaces, hyphens, and dots', () => {
            expect(sanitizeBankAccount('BE68 5390 0754 7034')).toBe('be68539007547034')
            expect(sanitizeBankAccount('123-456-789')).toBe('123456789')
            expect(sanitizeBankAccount('123.456.789')).toBe('123456789')
        })

        it('should convert to lowercase', () => {
            expect(sanitizeBankAccount('BE68ABCD')).toBe('be68abcd')
        })

        it('should handle undefined input', () => {
            expect(sanitizeBankAccount(undefined)).toBe('')
        })

        it('should handle empty string', () => {
            expect(sanitizeBankAccount('')).toBe('')
        })
    })

    describe('formatBankAccountDisplay', () => {
        describe('IBAN format', () => {
            it('should format IBAN with spaces every 4 characters', () => {
                const input = 'BE68539007547034'
                expect(formatBankAccountDisplay(input, 'iban')).toBe('BE68 5390 0754 7034')
            })

            it('should handle incomplete IBAN', () => {
                expect(formatBankAccountDisplay('BE685', 'iban')).toBe('BE68 5')
            })

            it('should convert to uppercase', () => {
                expect(formatBankAccountDisplay('be68539007547034', 'iban')).toBe('BE68 5390 0754 7034')
            })
        })

        describe('US account format', () => {
            it('should format US account with routing number', () => {
                const input = '123456789123456789'
                expect(formatBankAccountDisplay(input, 'us')).toBe('123456789-123456789')
            })

            it('should handle account number without routing number', () => {
                expect(formatBankAccountDisplay('123456789', 'us')).toBe('123456789')
            })

            it('should convert to uppercase', () => {
                expect(formatBankAccountDisplay('abcd1234', 'us')).toBe('ABCD1234')
            })
        })

        describe('Auto-detection', () => {
            it('should detect IBAN format', () => {
                expect(formatBankAccountDisplay('BE68539007547034')).toBe('BE68 5390 0754 7034')
            })

            it('should detect US account format', () => {
                expect(formatBankAccountDisplay('123456789123456789')).toBe('123456789-123456789')
            })
        })

        it('should handle undefined input', () => {
            expect(formatBankAccountDisplay(undefined)).toBe('')
        })
    })
})
