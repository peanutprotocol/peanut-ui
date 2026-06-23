import { extractPaymentValue } from './clipboard-extract.utils'

describe('extractPaymentValue', () => {
    it('extracts an EVM address from surrounding text', () => {
        expect(
            extractPaymentValue('send to 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 pls', 'evmAddress')
        ).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
        expect(extractPaymentValue('send to 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 pls', 'recipient')).toBe(
            '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
        )
    })

    it('returns null for recipient when no address is present (ENS/username fall through)', () => {
        expect(extractPaymentValue('vitalik.eth', 'recipient')).toBeNull()
        expect(extractPaymentValue('@someuser', 'recipient')).toBeNull()
    })

    it('extracts and cleans an IBAN, dropping spaces and trailing words', () => {
        expect(extractPaymentValue('IBAN: DE89 3704 0044 0532 0130 00', 'iban')).toBe('DE89370400440532013000')
        expect(extractPaymentValue('My IBAN is DE89 3704 0044 0532 0130 00, thanks!', 'iban')).toBe(
            'DE89370400440532013000'
        )
        expect(extractPaymentValue('DE89 3704 0044 0532 0130 00 thanks', 'iban')).toBe('DE89370400440532013000')
    })

    it('extracts a BIC but ignores ordinary words', () => {
        expect(extractPaymentValue('Bank BIC DEUTDEDBBER for transfer', 'bic')).toBe('DEUTDEDBBER')
        expect(extractPaymentValue('Deutsche Bank possible nonsense', 'bic')).toBeNull()
    })

    it('extracts a routing number by exact 9-digit group', () => {
        expect(extractPaymentValue('routing 021000021 acct 123456789012', 'routingNumber')).toBe('021000021')
    })

    it('extracts a US account number', () => {
        expect(extractPaymentValue('account no 123456789012', 'usAccount')).toBe('123456789012')
    })

    it('extracts a UK sort code with or without separators', () => {
        expect(extractPaymentValue('sort code 20-90-90', 'ukSortCode')).toBe('209090')
        expect(extractPaymentValue('sort 20 90 90', 'ukSortCode')).toBe('209090')
    })

    it('extracts a CLABE by exact 18-digit group', () => {
        expect(extractPaymentValue('CLABE 032180000118359719 BBVA', 'clabe')).toBe('032180000118359719')
    })

    it('extracts a PIX email/uuid/phone from text', () => {
        expect(extractPaymentValue('pix: pagamento@exemplo.com.br', 'pixKey')).toBe('pagamento@exemplo.com.br')
        expect(extractPaymentValue('key 123e4567-e89b-12d3-a456-426614174000 here', 'pixKey')).toBe(
            '123e4567-e89b-12d3-a456-426614174000'
        )
        expect(extractPaymentValue('phone +55 11 99999 9999', 'pixKey')).toBe('+5511999999999')
    })

    it('returns null when nothing valid is present', () => {
        expect(extractPaymentValue('just some random words', 'iban')).toBeNull()
        expect(extractPaymentValue('no digits here', 'routingNumber')).toBeNull()
    })
})
