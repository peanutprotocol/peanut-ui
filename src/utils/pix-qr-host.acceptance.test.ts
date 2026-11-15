import { pixQrHost } from './pix-qr-host'

// Synthetic EMV only. This contract concerns bounded TLV attribution, not settlement/CRC validation.
const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`
const account = (fields: string, tag = '26', gui = 'br.gov.bcb.pix') => tlv(tag, tlv('00', gui) + fields)
const dynamic = (url: string, tag = '26') => tlv('00', '01') + account(tlv('25', url), tag)

describe('bounded Pix host attribution acceptance', () => {
    it.each([
        ['basspago.com/qr/opaque', 'basspago'],
        ['https://qr.basspago.com.br/private', 'basspago'],
        ['BASSPAGO.COM.AR/qr', 'basspago'],
        ['mercadopago.com/qr', 'mercadopago'],
        ['https://qr.mercadopago.com.br/x', 'mercadopago'],
        ['mercadopago.com.ar/x', 'mercadopago'],
        ['https://payments.example/qr', 'other-dynamic'],
        ['https://notbasspago.com/qr', 'other-dynamic'],
        ['https://basspago.com.evil.invalid/x', 'other-dynamic'],
        ['https://example.com/basspago.com?host=mercadopago.com', 'other-dynamic'],
    ])('classifies only the actual hostname of %j', (url, expected) => {
        expect(pixQrHost(dynamic(url))).toBe(expected)
    })
    it.each(Array.from({ length: 26 }, (_, index) => String(index + 26)))(
        'recognizes Pix merchant-account tag %s',
        (tag) => expect(pixQrHost(dynamic('basspago.com/q', tag))).toBe('basspago')
    )
    it('matches the Pix GUI case-insensitively', () => {
        expect(pixQrHost(account(tlv('25', 'basspago.com/q'), '26', 'BR.GOV.BCB.PIX'))).toBe('basspago')
    })
    it.each([
        'http://basspago.com/q',
        'ftp://basspago.com/q',
        'https://user:password@basspago.com/q',
        'https://basspago.com:8443/q',
        'https://',
        'https://bad host.invalid/q',
        '',
    ])('rejects unsafe or malformed dynamic URLs: %j', (url) => {
        expect(pixQrHost(dynamic(url))).toBe('unknown')
    })
    it('does not misclassify a static key containing a provider hostname', () => {
        expect(pixQrHost(account(tlv('01', 'synthetic@basspago.com')))).toBe('static')
    })
    it('does not classify a provider name in a merchant name or non-Pix account', () => {
        expect(pixQrHost(tlv('59', 'basspago.com'))).toBe('unknown')
        expect(pixQrHost(account(tlv('25', 'basspago.com/q'), '26', 'example.non.pix'))).toBe('unknown')
    })
    it('does not accept a keyless static Pix account', () => {
        expect(pixQrHost(account(''))).toBe('unknown')
    })
    it('rejects conflicting nested dynamic fields and conflicting Pix accounts', () => {
        expect(pixQrHost(account(tlv('25', 'basspago.com/q') + tlv('25', 'mercadopago.com/q')))).toBe('unknown')
        expect(pixQrHost(dynamic('basspago.com/q') + account(tlv('25', 'mercadopago.com/q'), '27'))).toBe('unknown')
    })
    it('rejects truncated and malformed fields even after a recognizable provider', () => {
        const valid = dynamic('basspago.com/q')
        expect(pixQrHost(valid.slice(0, -1))).toBe('unknown')
        expect(pixQrHost(`${valid}5999short`)).toBe('unknown')
        expect(pixQrHost(`${valid}xx00`)).toBe('unknown')
        expect(pixQrHost(`${valid}59XXname`)).toBe('unknown')
    })
    it('rejects oversized input before exporting any classification', () => {
        expect(pixQrHost(dynamic('basspago.com/q') + '0'.repeat(4097))).toBe('unknown')
    })
    it('never throws or exports raw input under deterministic malformed-input fuzzing', () => {
        // Seed 0x51f00d, 256 cases, maximum generated body 512 chars; all are invalid TLV.
        let state = 0x51f00d
        const random = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0
            return state
        }
        const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz:/?@%_😀'
        for (let index = 0; index < 256; index++) {
            const length = random() % 513
            let value = 'XX'
            for (let offset = 0; offset < length; offset++) value += alphabet[random() % alphabet.length]
            expect(pixQrHost(value)).toBe('unknown')
        }
    })
})
