import { pixKeyToBRCode } from '@/utils/pix.utils'

jest.mock('@/assets', () => ({}))

describe('PIX Utilities', () => {
    describe('pixKeyToBRCode', () => {
        describe('Valid PIX keys should generate BR Codes', () => {
            it.each([
                // Email
                ['user@example.com', 'email'],
                ['test.user@domain.com.br', 'email with subdomain'],
                // CPF (11 digits)
                ['12345678901', 'CPF'],
                ['98765432100', 'another CPF'],
                // CNPJ (14 digits)
                ['12345678901234', 'CNPJ'],
                // Phone numbers
                ['+5511999999999', 'phone with +'],
                ['5511999999999', 'phone without +'],
                // UUID (random key)
                ['123e4567-e89b-12d3-a456-426614174000', 'UUID'],
            ])('should generate BR Code for %s (%s)', (pixKey, _description) => {
                const result = pixKeyToBRCode(pixKey)
                expect(result).not.toBeNull()
                expect(result).toContain('000201')
                expect(result).toContain('br.gov.bcb.pix')
                expect(result).toContain('5802BR')
                expect(result).toContain('5303986')
            })
        })

        describe('BR Codes should be returned as-is', () => {
            it.each([
                [
                    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                    'standard PIX QR',
                ],
                [
                    '00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/c75d8412-3935-49d1-9d80-6435716962665204000053039865802BR5925SMARTPAY_SERVICOS_DIGITAI6013FLORIANOPOLIS62070503***6304575A',
                    'dynamic PIX QR',
                ],
            ])('should return existing BR Code as-is: %s', (brCode, _description) => {
                const result = pixKeyToBRCode(brCode)
                expect(result).toBe(brCode)
            })
        })

        describe('Invalid PIX keys should return null', () => {
            it.each([
                ['', 'empty string'],
                ['   ', 'whitespace only'],
                ['invalid', 'random text'],
                ['123456', 'too short number'],
                ['11111111111', 'all same digits CPF'],
                ['00000000000000', 'all zeros CNPJ'],
                ['not-a-valid-email', 'invalid email'],
                ['123e4567-e89b-12d3-a456', 'incomplete UUID'],
                ['+5511', 'too short phone'],
            ])('should return null for %s (%s)', (pixKey, _description) => {
                const result = pixKeyToBRCode(pixKey)
                expect(result).toBeNull()
            })
        })

        describe('Merchant name truncation', () => {
            it('should handle long PIX keys by truncating merchant name', () => {
                const longEmail = 'verylongemailaddress@verylongdomain.com.br'
                const result = pixKeyToBRCode(longEmail)
                expect(result).not.toBeNull()
                // The BR Code should still be valid even with truncated merchant name
                expect(result).toContain('000201')
                expect(result).toContain('br.gov.bcb.pix')
            })
        })

        describe('Case preservation', () => {
            it('should preserve email case in the PIX key', () => {
                const email = 'User.Name@Example.COM'
                const result = pixKeyToBRCode(email)
                expect(result).not.toBeNull()
                // The email should be preserved in the BR Code
                expect(result).toContain('User.Name@Example.COM')
            })
        })

        describe('Whitespace handling', () => {
            it('should trim leading/trailing whitespace', () => {
                const result = pixKeyToBRCode('  user@example.com  ')
                expect(result).not.toBeNull()
                expect(result).toContain('user@example.com')
            })
        })
    })
})
