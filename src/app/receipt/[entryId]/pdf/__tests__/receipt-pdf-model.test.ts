// The PDF's data model is derived from the same TransactionDetails view model
// the receipt page renders — these tests pin which rows a given transaction
// produces, with an identity-ish translator so assertions read as catalog keys.
import { buildReceiptPdfModel, type PdfTranslate } from '../receipt-pdf-model'
import { EHistoryUserRole } from '@/utils/history.utils'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { createTranslator } from 'next-intl'
import { APP_LOCALES, type AppLocale } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const t: PdfTranslate = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

const baseTx = {
    id: 'a3f5c250-1234-4abc-8def-9012aa34bb56',
    direction: 'bank_withdraw',
    userName: 'kkonrad',
    fullName: '',
    amount: 125.5,
    initials: 'KK',
    status: 'completed',
    date: '2026-08-20T14:05:00.000Z',
    createdAt: '2026-08-20T14:05:00.000Z',
    completedAt: '2026-08-20T15:22:00.000Z',
    fee: 0.5,
    txHash: '0x74a9c1e9c1f5f3ab8a7e2ac5c250aabb',
    totalAmountCollected: 0,
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.SENDER,
        kind: 'OFFRAMP',
        transactionCardType: 'bank_withdraw',
    },
} as unknown as TransactionDetails

const withOverrides = (overrides: Record<string, unknown>, drawerOverrides: Record<string, unknown> = {}) =>
    ({
        ...baseTx,
        ...overrides,
        extraDataForDrawer: { ...(baseTx.extraDataForDrawer as Record<string, unknown>), ...drawerOverrides },
    }) as unknown as TransactionDetails

const labels = (model: ReturnType<typeof buildReceiptPdfModel>) => model.rows.map((r) => r.label)
const row = (model: ReturnType<typeof buildReceiptPdfModel>, label: string) =>
    model.rows.find((r) => r.label === label)?.value

describe('buildReceiptPdfModel — completed bank withdraw', () => {
    const model = buildReceiptPdfModel(baseTx, t, 'en')

    // The filename lands in a quoted Content-Disposition header, and ids are
    // arbitrary backend strings — a quote would inject header tokens and a
    // CR/LF would make the Headers constructor throw (a 500 per receipt).
    test('sanitizes the download filename', () => {
        const nasty = { ...baseTx, id: 'ab"cd\r\nX-Injected: 1' }
        const m = buildReceiptPdfModel(nasty, t, 'en')
        expect(m.fileName).toBe('peanut-receipt-abcdX-Injected1.pdf')
        expect(m.fileName).not.toMatch(/["\r\n]/)
    })

    // Manteca synthetic ids are case-sensitive lookup keys: an id that was
    // uppercased could not be used to find the entry it belongs to.
    test('keeps a mixed-case receipt id verbatim in its transaction row', () => {
        const mixed = { ...baseTx, id: 'MaNtEcA-Qr-7f3B-AbCd' }
        const m = buildReceiptPdfModel(mixed, t, 'en')
        expect(row(m, 'transaction.rows.transferId')).toBe('MaNtEcA-Qr-7f3B-AbCd')
    })

    test('carries the official-document header and footer facts', () => {
        expect(model.title).toBe('transaction.officialReceipt.pdf.title')
        expect(model.issuedBy).toBe('transaction.officialReceipt.issuedBy')
        expect(model.companyName).toBe('Squirrel Labs Ltd')
        expect(model.companyAddressLines).toEqual([
            'Office One',
            '1 Coldbath Square',
            'Farringdon, London, EC1R 5HL, UK',
        ])
        expect(model.site).toBe('peanut.me')
        expect(model.fileName).toBe(`peanut-receipt-${baseTx.id}.pdf`)
    })

    test('renders amount, status, and the core rows', () => {
        // formatCurrency mirrors the page: decimal places follow the input string
        expect(model.amountDisplay).toBe('$125.5')
        expect(model.rows[0]).toEqual({
            label: 'transaction.officialReceipt.pdf.date',
            value: expect.stringContaining('2026'),
        })
        expect(row(model, 'transaction.officialReceipt.pdf.type')).toBe('transaction.type.bank_withdraw')
        expect(row(model, 'transaction.officialReceipt.pdf.status')).toBe('common.status.completed')
        expect(row(model, 'transaction.rows.to')).toBe('kkonrad')
        expect(row(model, 'transaction.rows.fee')).toBe('0.5')
        expect(row(model, 'transaction.rows.txId')).toBe(baseTx.txHash)
        // bank_withdraw carries its transfer reference
        expect(row(model, 'transaction.rows.transferId')).toBe(baseTx.id)
        expect(labels(model)).not.toContain('transaction.rows.pointsEarned')
    })

    test('completed OFFRAMP uses one Date field at the top', () => {
        expect(row(model, 'transaction.officialReceipt.pdf.date')).toContain('2026')
        expect(labels(model)).not.toContain('transaction.rows.completed')
        expect(labels(model)).not.toContain('transaction.rows.created')
    })
})

describe('buildReceiptPdfModel — variants', () => {
    test('pending entry uses its creation timestamp for the Date field', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ status: 'pending', completedAt: undefined, txHash: undefined }),
            t,
            'en'
        )
        expect(row(model, 'transaction.officialReceipt.pdf.date')).toContain('2026')
        expect(labels(model)).not.toContain('transaction.rows.created')
        expect(labels(model)).not.toContain('transaction.rows.completed')
        expect(labels(model)).not.toContain('transaction.rows.txId')
    })

    test('recipient-side entry labels the counterparty as From', () => {
        const model = buildReceiptPdfModel(withOverrides({}, { originalUserRole: EHistoryUserRole.RECIPIENT }), t, 'en')
        expect(row(model, 'transaction.officialReceipt.pdf.from')).toBe('kkonrad')
    })

    test('FE-generated labels localize via nameKey with params', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ nameKey: 'name.bankAccount', nameParams: { last4: '1332' } }),
            t,
            'en'
        )
        expect(row(model, 'transaction.rows.to')).toBe('transaction.name.bankAccount:{"last4":"1332"}')
    })

    test('non-USD fiat leg renders converted amount and the FX rate row', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ currency: { amount: '113250.75', code: 'ARS' } }, { receipt: { exchange_rate: '902.4' } }),
            t,
            'en'
        )
        expect(model.convertedAmountDisplay).toBe('ARS 113,250.75')
        expect(row(model, 'common.exchangeRate')).toBe('1 USD = ARS 902.4')
    })

    test('bank account identifiers are always masked — the PDF is shareable', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ bankAccountDetails: { identifier: 'ES9121000418450200051332', type: 'BANK_IBAN' } }),
            t,
            'en'
        )
        const value = row(model, 'IBAN')
        expect(value).toBeDefined()
        expect(value).not.toBe('ES9121000418450200051332')
        expect(value).toContain('1332')
    })

    test('cancelled entries drop fee/bank/transfer rows but keep the Date field', () => {
        const model = buildReceiptPdfModel(
            withOverrides({
                status: 'cancelled',
                cancelledDate: '2026-08-21T09:00:00.000Z',
                completedAt: undefined,
                bankAccountDetails: { identifier: 'ES9121000418450200051332', type: 'BANK_IBAN' },
            }),
            t,
            'en'
        )
        expect(row(model, 'transaction.officialReceipt.pdf.date')).toContain('2026')
        expect(labels(model)).not.toContain('transaction.rows.cancelled')
        expect(labels(model)).not.toContain('transaction.rows.fee')
        expect(labels(model)).not.toContain('transaction.rows.transferId')
        expect(labels(model)).not.toContain('IBAN')
    })

    test('memo renders as the comment row, memoKey preferred over raw memo', () => {
        const withMemo = buildReceiptPdfModel(withOverrides({ memo: 'invoice #42' }), t, 'en')
        expect(row(withMemo, 'common.comment')).toBe('invoice #42')

        const withKey = buildReceiptPdfModel(withOverrides({ memo: 'x', memoKey: 'memoTestDeposit' }), t, 'en')
        expect(row(withKey, 'common.comment')).toBe('transaction.memoTestDeposit')
    })

    test('unparsable dates fall back to an ASCII marker instead of throwing', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ status: 'pending', createdAt: 'not-a-date', completedAt: undefined }),
            t,
            'en'
        )
        expect(row(model, 'transaction.officialReceipt.pdf.date')).toBe('-')
    })
})

describe('buildReceiptPdfModel — app locales', () => {
    const localizedCopy: ReadonlyArray<[AppLocale, string, string]> = [
        ['en', 'Transaction Receipt', 'Date'],
        ['es-419', 'Comprobante de la transacción', 'Fecha'],
        ['es-AR', 'Comprobante de la transacción', 'Fecha'],
        ['pt-BR', 'Comprovante da transação', 'Data'],
    ]

    test('covers every supported app locale', () => {
        expect(localizedCopy.map(([locale]) => locale)).toEqual(APP_LOCALES)
    })

    test.each(localizedCopy)('renders receipt copy in %s', async (locale, title, dateLabel) => {
        const messages = await loadMessages(locale)
        const translate = createTranslator({ locale, messages }) as PdfTranslate
        const model = buildReceiptPdfModel(baseTx, translate, locale)

        expect(model.title).toBe(title)
        expect(model.rows[0].label).toBe(dateLabel)
    })
})
