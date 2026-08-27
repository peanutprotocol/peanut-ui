/** @jest-environment node */
// End-to-end through the real react-pdf pipeline: model → renderReceiptPdf →
// bytes. Guards against the renderer wedging on fonts, the SVG wordmark, or
// layout — "it typechecks" is not evidence a PDF comes out.
import { renderReceiptPdf } from '../ReceiptPdfDocument'
import type { ReceiptPdfModel } from '../receipt-pdf-model'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const model: ReceiptPdfModel = {
    title: 'Payment Receipt',
    issuedBy: 'Issued by Peanut',
    site: 'peanut.me',
    amountDisplay: '$125.5',
    convertedAmountDisplay: 'ARS 113,250.75',
    statusLabel: 'Completed',
    rows: [
        { label: 'Type', value: 'Withdraw' },
        { label: 'Status', value: 'Completed' },
        { label: 'To', value: 'kkonrad' },
        { label: 'Completed', value: 'August 20, 2026 - 15:22 UTC' },
        { label: 'Exchange rate', value: '1 USD = ARS 902.4' },
        { label: 'Fee', value: '0.5' },
        { label: 'TX ID', value: '0x74a9c1e9c1f5f3ab8a7e2ac5c250aabbccddeeff00112233445566778899aabb' },
        { label: 'IBAN', value: 'ES91 **** **** **** **** 1332' },
    ],
    referenceLabel: 'Receipt reference',
    reference: 'A3F5C250-1234-4ABC-8DEF-9012AA34BB56',
    issuedOnLabel: 'Issued on',
    issuedOn: 'August 20, 2026 - 15:22 UTC',
    fileName: 'peanut-receipt-a3f5c250.pdf',
}

describe('long identifier wrapping', () => {
    // A 66-char tx hash is wider than the value column. Without a break it
    // overflows the row, and the byte-level assertions below still pass — so
    // assert the wrapping helper directly. It must never ADD a character:
    // react-pdf's hyphenation callback wraps but renders a hyphen at the break,
    // which would corrupt a hash read off the page.
    test('hard-wraps identifiers without altering their characters', async () => {
        const { breakableIdentifier } = await import('../ReceiptPdfDocument')
        const hash = '0x74a9c1e9c1f5f3ab8a7e2ac5c250aabbccddeeff00112233445566778899aabb'

        const wrapped = breakableIdentifier(hash)
        expect(wrapped).toContain('\n')
        expect(wrapped.split('\n').join('')).toBe(hash)
        expect(wrapped).not.toContain('-')

        // a mixed-case Manteca reference wraps too, case intact
        const ref = 'MaNtEcA-Qr-7f3B-AbCd-0123456789abcdef0123456789'
        expect(breakableIdentifier(ref).split('\n').join('')).toBe(ref)
    })

    test('leaves ordinary values untouched', async () => {
        const { breakableIdentifier } = await import('../ReceiptPdfDocument')
        expect(breakableIdentifier('Completed')).toBe('Completed')
        expect(breakableIdentifier('August 20, 2026 - 15:22 UTC')).toBe('August 20, 2026 - 15:22 UTC')
        expect(breakableIdentifier('ES91 **** **** **** **** 1332')).toBe('ES91 **** **** **** **** 1332')
    })
})

describe('renderReceiptPdf', () => {
    test('produces a real, non-trivial PDF document', async () => {
        const buffer = await renderReceiptPdf(model)
        expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
        expect(buffer.length).toBeGreaterThan(10_000)
        // trailer lands, i.e. the document was finalized, not truncated
        expect(buffer.subarray(-1024).toString('latin1')).toContain('%%EOF')
    }, 30_000)
})
