import {
    defaultPixKeyNickname,
    pixKeyOwnerDetails,
    pixKeyToBRCode,
    pixKeyToQrPayUrl,
    verifiedPixKeyLabel,
} from '@/utils/pix.utils'

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

    describe('pixKeyToQrPayUrl', () => {
        it('wraps a valid PIX key into a /qr-pay PIX redirect with the encoded BR Code', () => {
            const url = pixKeyToQrPayUrl('user@example.com')
            expect(url).not.toBeNull()
            expect(url).toMatch(/^\/qr-pay\?qrCode=/)
            expect(url).toContain('&type=PIX')
            // The encoded BR Code round-trips back to what pixKeyToBRCode produced.
            const qrCode = new URLSearchParams(url!.split('?')[1]).get('qrCode')
            expect(qrCode).toBe(pixKeyToBRCode('user@example.com'))
        })

        it('passes an existing BR Code through unchanged', () => {
            const brCode =
                '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'
            const url = pixKeyToQrPayUrl(brCode)
            const qrCode = new URLSearchParams(url!.split('?')[1]).get('qrCode')
            expect(qrCode).toBe(brCode)
        })

        it('returns null for an invalid PIX key so callers can surface an error', () => {
            expect(pixKeyToQrPayUrl('not-a-valid-key')).toBeNull()
            expect(pixKeyToQrPayUrl('')).toBeNull()
        })

        // BR Code field 26, sub-field 01: the key, with its two-digit length.
        it.each([
            ['123.456.789-09', '12345678909'],
            ['12.345.678/0001-95', '12345678000195'],
            ['5511912345678', '+5511912345678'],
        ])('pays and names a typed key %s in its directory form %s', (typed, key) => {
            const params = new URLSearchParams(pixKeyToQrPayUrl(typed)!.split('?')[1])
            expect(params.get('qrCode')).toContain(`01${String(key.length).padStart(2, '0')}${key}`)
            expect(params.get('pixKey')).toBe(key)
            expect(verifiedPixKeyLabel(params.get('qrCode')!, params.get('pixKey'))).toBe(key)
        })
    })
})

/**
 * A pasted "Pix copia e cola" is usually uppercase — the BCB manual prints the
 * GUI as BR.GOV.BCB.PIX and most PSPs follow it. isPixEmvcoQr matched the GUI
 * case-sensitively, so every paste path rejected the canonical payload while
 * scanning kept working (the scanner lowercases before recognizeQr).
 */
describe('uppercase copia-e-cola payloads', () => {
    const UPPER =
        '00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'

    it('keeps an uppercase BR Code verbatim instead of returning null', () => {
        expect(pixKeyToBRCode(UPPER)).toBe(UPPER)
    })

    it('routes an uppercase BR Code to qr-pay with the payload intact', () => {
        const url = pixKeyToQrPayUrl(UPPER)
        expect(url).not.toBeNull()
        expect(decodeURIComponent(new URL(url!, 'https://peanut.me').searchParams.get('qrCode')!)).toBe(UPPER)
    })
})

test('full PIX key survives the redirect and cannot mislabel a different payment', () => {
    const key = 'verylongemailaddress@verylongdomain.com.br'
    const params = new URLSearchParams(pixKeyToQrPayUrl(key)!.split('?')[1])
    expect(verifiedPixKeyLabel(params.get('qrCode')!, params.get('pixKey'))).toBe(key)
    expect(verifiedPixKeyLabel(pixKeyToBRCode('other@example.com')!, key)).toBeNull()
})

describe('pixKeyOwnerDetails', () => {
    it('shows a CPF key once, in full, as the CPF it is', () => {
        expect(pixKeyOwnerDetails('09579927189', '09*******89')).toEqual({
            pixKey: null,
            taxId: { kind: 'CPF', value: '095.799.271-89' },
        })
    })

    it('shows a CNPJ key once, in full, as the CNPJ it is', () => {
        expect(pixKeyOwnerDetails('11222333000181', '11**********81')).toEqual({
            pixKey: null,
            taxId: { kind: 'CNPJ', value: '11.222.333/0001-81' },
        })
    })

    it('shows any other key next to the masked tax ID, labelled by its length', () => {
        expect(pixKeyOwnerDetails('maria@silva.com.br', '04*******80')).toEqual({
            pixKey: 'maria@silva.com.br',
            taxId: { kind: 'CPF', value: '04*******80' },
        })
        expect(pixKeyOwnerDetails('+5511912345678', '11**********81')).toEqual({
            pixKey: '+5511912345678',
            taxId: { kind: 'CNPJ', value: '11**********81' },
        })
    })

    it('leaves out a tax ID whose kind cannot be told, or that is missing', () => {
        expect(pixKeyOwnerDetails('maria@silva.com.br', '20********87')).toEqual({
            pixKey: 'maria@silva.com.br',
            taxId: null,
        })
        expect(pixKeyOwnerDetails('maria@silva.com.br', null)).toEqual({ pixKey: 'maria@silva.com.br', taxId: null })
    })
})

describe('defaultPixKeyNickname', () => {
    it('keeps a name that fits the 15-character address-book cap', () => {
        expect(defaultPixKeyNickname(' MARIA  DA SILVA ')).toBe('MARIA DA SILVA')
    })

    it('falls back to the first name, cut to fit', () => {
        expect(defaultPixKeyNickname('Arthur de Jesus Lima Alvino')).toBe('Arthur')
        expect(defaultPixKeyNickname('Maximilianogregorio Santos')).toBe('Maximilianogreg')
    })
})
