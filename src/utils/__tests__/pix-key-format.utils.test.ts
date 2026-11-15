import { formatPixKey } from '../pix-key-format.utils'

describe('formatPixKey', () => {
    it.each([
        // a CPF: 11 digits with valid check digits
        ['11144477735', '111.444.777-35'],
        // 11 digits that are no CPF: a phone typed without +55
        ['11999999999', '11 99999-9999'],
        // a phone as the directory holds it
        ['+5511999999999', '11 99999-9999'],
        // a landline
        ['+551133334444', '11 3333-4444'],
        // a CNPJ with valid check digits, and one without (the owner's example)
        ['12345678000195', '12.345.678/0001-95'],
        ['12345678000190', '12.345.678/0001-90'],
        // already punctuated: printed the same way
        ['111.444.777-35', '111.444.777-35'],
    ])('formats %s as %s', (key, shown) => {
        expect(formatPixKey(key)).toBe(shown)
    })

    it.each(['maria@silva.com.br', '123e4567-e89b-12d3-a456-426614174000', '+15551234567'])(
        'prints %s as it is',
        (key) => {
            expect(formatPixKey(key)).toBe(key)
        }
    )
})
