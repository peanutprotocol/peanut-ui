import {
    validateCbuCvuAlias,
    isPixPhoneNumber,
    normalizePixPhoneNumber,
    isPixEmvcoQr,
    validatePixKey,
} from '@/utils/withdraw.utils'

jest.mock('@/assets', () => ({}))

describe('Withdraw Utilities', () => {
    describe('validateCbuCvuAlias', () => {
        it.each([
            { value: '', valid: false, message: 'Invalid length' },
            { value: 'alias', valid: false, message: 'Invalid length' },
            { value: 'alias.testvc.eth', valid: true, message: undefined },
            { value: 'alias123', valid: true, message: undefined },
            { value: '123456', valid: true, message: undefined },
            { value: 'alias123!', valid: false, message: 'Alias must contain only letters, numbers, dots, and dashes' },
            {
                value: '0000003100066354450378',
                valid: false,
                message: 'Invalid CBU/CVU - check that you entered it correctly',
            },
            {
                value: '0000003200066354450379',
                valid: false,
                message: 'Invalid CBU/CVU - check that you entered it correctly',
            },
            { value: '0000003100066354450379', valid: true, message: undefined },
            { value: '000000310006635445037', valid: false, message: 'Invalid length' },
            { value: '000000310006635445037b', valid: false, message: 'CBU/CVU must contain only numbers' },
        ])('should be valid $valid for $value', ({ value, valid, message }) => {
            const result = validateCbuCvuAlias(value)
            expect(result.valid).toBe(valid)
            expect(result.message).toBe(message)
        })
    })

    describe('isPixPhoneNumber', () => {
        it.each([
            // Valid phone numbers with +
            ['+5511999999999', true],
            ['+551199999999', true],
            ['+5521987654321', true],
            ['+55119999999999', false], // Too many digits
            // Valid phone numbers without +
            ['5511999999999', true],
            ['551199999999', true],
            ['5521987654321', true],
            // Invalid - missing country code
            ['11999999999', false],
            ['119999999999', false],
            // Invalid - wrong country code
            ['+54119999999', false],
            ['+1234567890', false],
            // Invalid - too short
            ['+5511', false],
            ['5511', false],
            // Invalid - non-numeric
            ['abc5511999999999', false],
            ['+55abc99999999', false],
            // Invalid - other formats
            ['12345678901', false], // CPF
            ['user@example.com', false],
            ['', false],
        ])('should return %s for %s', (input, expected) => {
            expect(isPixPhoneNumber(input)).toBe(expected)
        })
    })

    describe('normalizePixPhoneNumber', () => {
        it.each([
            // Should add + prefix
            ['5511999999999', '+5511999999999'],
            ['551199999999', '+551199999999'],
            ['5521987654321', '+5521987654321'],
            // Should keep existing + prefix
            ['+5511999999999', '+5511999999999'],
            ['+551199999999', '+551199999999'],
            // Should not modify non-phone formats
            ['12345678901', '12345678901'], // CPF
            ['12345678901234', '12345678901234'], // CNPJ
            ['user@example.com', 'user@example.com'],
            ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174000'], // UUID
            ['11999999999', '11999999999'], // Missing country code
            ['', ''],
        ])('should normalize %s to %s', (input, expected) => {
            expect(normalizePixPhoneNumber(input)).toBe(expected)
        })
    })

    describe('isPixEmvcoQr', () => {
        it.each([
            // Valid EMVCo QR codes
            [
                '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                true,
            ],
            [
                '00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/c75d8412-3935-49d1-9d80-6435716962665204000053039865802BR5925SMARTPAY_SERVICOS_DIGITAI6013FLORIANOPOLIS62070503***6304575A',
                true,
            ],
            // Invalid - starts with 000201 but no br.gov.bcb.pix
            ['000201260014something.else', false],
            // Invalid - has br.gov.bcb.pix but wrong prefix
            ['999999260014br.gov.bcb.pix0136123e4567', false],
            // Invalid - random strings
            ['12345678901', false],
            ['user@example.com', false],
            ['', false],
        ])('should return %s for %s', (input, expected) => {
            expect(isPixEmvcoQr(input)).toBe(expected)
        })
    })

    describe('validatePixKey', () => {
        describe('Phone Numbers', () => {
            it.each([
                // Valid phone numbers
                { value: '+5511999999999', valid: true, message: undefined },
                { value: '+551199999999', valid: true, message: undefined },
                { value: '5511999999999', valid: true, message: undefined },
                { value: '551199999999', valid: true, message: undefined },
                { value: '+5521987654321', valid: true, message: undefined },
                // Invalid phone numbers
                { value: '+5511', valid: false, message: 'Invalid phone number format' },
                { value: '+551199999999999', valid: false, message: 'Invalid phone number format' }, // Too many digits
                { value: '5511', valid: false, message: 'Invalid phone number format' }, // Too short without +
            ])('should validate phone number $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('CPF (11 digits)', () => {
            it.each([
                // Valid CPF
                { value: '12345678901', valid: true, message: undefined },
                { value: '98765432100', valid: true, message: undefined },
                { value: '11999999999', valid: true, message: undefined }, // Starts with 11, not 55 - valid CPF
                { value: '123.456.789-01', valid: true, message: undefined }, // Formatted
                // Invalid CPF
                { value: '11111111111', valid: false, message: 'Invalid CPF (all digits are the same)' },
                { value: '00000000000', valid: false, message: 'Invalid CPF (all digits are the same)' },
                { value: '1234567890', valid: false, message: undefined }, // Too short
                { value: '123456789012', valid: false, message: undefined }, // Too long
            ])('should validate CPF $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('CNPJ (14 digits)', () => {
            it.each([
                // Valid CNPJ
                { value: '12345678901234', valid: true, message: undefined },
                { value: '98765432109876', valid: true, message: undefined },
                // Invalid CNPJ
                { value: '11111111111111', valid: false, message: 'Invalid CNPJ (all digits are the same)' },
                { value: '00000000000000', valid: false, message: 'Invalid CNPJ (all digits are the same)' },
                { value: '1234567890123', valid: false, message: undefined }, // Too short
            ])('should validate CNPJ $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('Email', () => {
            it.each([
                // Valid emails
                { value: 'user@example.com', valid: true, message: undefined },
                { value: 'user.name@example.com', valid: true, message: undefined },
                { value: 'user+tag@example.co.uk', valid: true, message: undefined },
                { value: 'test123@domain.com.br', valid: true, message: undefined },
                // Invalid emails
                { value: 'user@', valid: false, message: undefined },
                { value: '@example.com', valid: false, message: undefined },
                { value: 'user@example', valid: false, message: undefined },
                {
                    value: 'a'.repeat(70) + '@example.com',
                    valid: false,
                    message: 'Email is too long (max 77 characters)',
                },
            ])('should validate email $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('UUID (Random Key)', () => {
            it.each([
                // Valid UUIDs
                { value: '123e4567-e89b-12d3-a456-426614174000', valid: true, message: undefined },
                { value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', valid: true, message: undefined },
                { value: '00000000-0000-0000-0000-000000000000', valid: true, message: undefined },
                // Invalid UUIDs
                { value: '123e4567-e89b-12d3-a456', valid: false, message: undefined }, // Incomplete
                { value: '123e4567e89b12d3a456426614174000', valid: false, message: undefined }, // No dashes
                { value: 'not-a-uuid-format', valid: false, message: undefined },
            ])('should validate UUID $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('EMVCo QR Code', () => {
            it.each([
                // Valid QR codes
                {
                    value: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                    valid: true,
                    message: undefined,
                },
                {
                    value: '00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/c75d8412-3935-49d1-9d80-6435716962665204000053039865802BR5925SMARTPAY_SERVICOS_DIGITAI6013FLORIANOPOLIS62070503***6304575A',
                    valid: true,
                    message: undefined,
                },
                // Invalid QR codes
                {
                    value: '000201br.gov.bcb.pix',
                    valid: false,
                    message: 'Invalid QR code length',
                }, // Too short
                {
                    value: '000201' + 'x'.repeat(500) + 'br.gov.bcb.pix',
                    valid: false,
                    message: 'Invalid QR code length',
                }, // Too long
            ])('should validate QR code as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })

        describe('Edge Cases', () => {
            it.each([
                // Empty and whitespace
                { value: '', valid: false, message: 'PIX key cannot be empty' },
                { value: '   ', valid: false, message: 'PIX key cannot be empty' },
                // Random invalid formats
                {
                    value: 'random-text',
                    valid: false,
                    message: 'Invalid PIX key format. Must be phone, CPF, CNPJ, email, random key, or QR code',
                },
                {
                    value: '123456',
                    valid: false,
                    message: 'Invalid PIX key format. Must be phone, CPF, CNPJ, email, random key, or QR code',
                },
            ])('should validate edge case $value as $valid', ({ value, valid, message }) => {
                const result = validatePixKey(value)
                expect(result.valid).toBe(valid)
                if (message) {
                    expect(result.message).toBe(message)
                }
            })
        })
    })
})
