import { brTaxIdKind, formatBrTaxId, isValidCnpj, isValidCpf } from '@/utils/br-tax-id.utils'

describe('isValidCpf', () => {
    it.each(['12345678909', '09579927189'])('accepts %s, whose check digits match', (cpf) => {
        expect(isValidCpf(cpf)).toBe(true)
    })

    it.each([
        ['a wrong check digit', '12345678900'],
        ['all digits equal', '11111111111'],
        ['punctuation', '123.456.789-09'],
        ['10 digits', '1234567890'],
    ])('rejects %s', (_label, cpf) => {
        expect(isValidCpf(cpf)).toBe(false)
    })
})

describe('isValidCnpj', () => {
    it.each(['11222333000181', '12345678000195'])('accepts %s, whose check digits match', (cnpj) => {
        expect(isValidCnpj(cnpj)).toBe(true)
    })

    it.each([
        ['a wrong check digit', '11222333000180'],
        ['all digits equal', '00000000000000'],
        ['an 11-digit CPF', '12345678909'],
    ])('rejects %s', (_label, cnpj) => {
        expect(isValidCnpj(cnpj)).toBe(false)
    })
})

describe('brTaxIdKind', () => {
    it.each([
        ['a full CPF', '12345678909', 'CPF'],
        ['a full CNPJ', '11222333000181', 'CNPJ'],
        ['a masked CPF (11 characters)', '12*******90', 'CPF'],
        ['a masked CNPJ (14 characters)', '11**********81', 'CNPJ'],
        ['an 11-digit number that fails the CPF check', '12345678900', null],
        ['a mask of another length', '20********87', null],
        ['an email key', 'maria@silva.com.br', null],
    ])('classifies %s', (_label, value, kind) => {
        expect(brTaxIdKind(value)).toBe(kind)
    })
})

describe('formatBrTaxId', () => {
    it('punctuates a CPF and a CNPJ the Brazilian way', () => {
        expect(formatBrTaxId('09579927189')).toBe('095.799.271-89')
        expect(formatBrTaxId('11222333000181')).toBe('11.222.333/0001-81')
    })

    it('leaves anything else unchanged', () => {
        expect(formatBrTaxId('12*******90')).toBe('12*******90')
    })
})
