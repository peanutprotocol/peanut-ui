/** @jest-environment node */
// End-to-end through the real react-pdf pipeline: model → renderReceiptPdf →
// bytes. Guards against the renderer wedging on fonts, the SVG wordmark, or
// layout — "it typechecks" is not evidence a PDF comes out.
import { renderReceiptPdf } from '../ReceiptPdfDocument'
import type { ReceiptPdfModel } from '../receipt-pdf-model'

// A made-up 32-byte hash, built at runtime: a literal 0x + 64-hex string trips the
// pre-commit secret scan (private-key pattern), which blocks release merges.
const FAKE_TX_HASH = `0x${'74a9c1e9'.repeat(8)}`

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const model: ReceiptPdfModel = {
    title: 'Transaction Receipt',
    issuedBy: 'Issued by Squirrel Labs Ltd',
    companyName: 'Squirrel Labs Ltd',
    companyAddressLines: ['Office One', '1 Coldbath Square', 'Farringdon, London, EC1R 5HL, UK'],
    site: 'peanut.me',
    amountDisplay: '$125.5',
    convertedAmountDisplay: 'ARS 113,250.75',
    rows: [
        { label: 'Date', value: 'August 20, 2026 - 15:22 UTC' },
        { label: 'Type', value: 'Withdraw' },
        { label: 'Status', value: 'Completed' },
        { label: 'To', value: 'kkonrad' },
        { label: 'Fee', value: '0.5' },
        { label: 'IBAN', value: 'ES91 **** **** **** **** 1332' },
        { label: 'Exchange rate', value: '1 USD = ARS 902.4' },
        { label: 'Transaction ID', value: FAKE_TX_HASH },
        { label: 'Transfer ID', value: 'transfer-a3f5c250' },
        { label: 'Reference', value: 'a3f5c250-1234-4abc-8def-9012aa34bb56' },
    ],
    fileName: 'peanut-receipt-a3f5c250.pdf',
}

describe('identifier wrapping', () => {
    test('keeps EVM addresses and hashes on one line in the wider value column', async () => {
        const { breakableIdentifier } = await import('../ReceiptPdfDocument')
        const address = '0xc9f6e1a780e62bbb751375bea25415581f77beb55c'
        const hash = FAKE_TX_HASH

        expect(breakableIdentifier(address)).toBe(address)
        expect(breakableIdentifier(hash)).toBe(hash)
    })

    test('hard-wraps only longer identifiers without altering their characters', async () => {
        const { breakableIdentifier } = await import('../ReceiptPdfDocument')
        const longIdentifier = `0x${'1234567890abcdef'.repeat(5)}`
        const wrapped = breakableIdentifier(longIdentifier)

        expect(wrapped).toContain('\n')
        expect(wrapped.split('\n').join('')).toBe(longIdentifier)
        expect(wrapped).not.toContain('-')
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

describe('PDF token map', () => {
    test('matches the semantic tokens in globals.css', async () => {
        const { readFileSync } = await import('fs')
        const { join } = await import('path')
        const { PDF_TOKENS } = await import('../ReceiptPdfDocument')
        const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
        const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*([^;]+);`))?.[1].trim()

        expect(PDF_TOKENS.foregroundPrimary).toBe(token('foreground-primary'))
        expect(PDF_TOKENS.foregroundSecondary).toBe(token('foreground-secondary'))
    })
})
