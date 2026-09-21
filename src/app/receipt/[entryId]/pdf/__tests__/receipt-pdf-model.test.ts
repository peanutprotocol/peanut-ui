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
    test('keeps a mixed-case receipt id verbatim in its reference row', () => {
        const mixed = { ...baseTx, id: 'MaNtEcA-Qr-7f3B-AbCd' }
        const m = buildReceiptPdfModel(mixed, t, 'en')
        expect(row(m, 'transaction.officialReceipt.reference')).toBe('MaNtEcA-Qr-7f3B-AbCd')
    })

    test('carries the official-document header and footer facts', () => {
        expect(model.title).toBe('transaction.officialReceipt.pdf.title')
        expect(model.issuedBy).toBe('transaction.officialReceipt.pdf.issuedBy')
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
        // signed like the screen: a bank withdraw is money leaving
        expect(model.amountDisplay).toBe('-$125.5')
        expect(model.rows[0]).toEqual({
            label: 'transaction.officialReceipt.issuedOn',
            value: expect.stringContaining('2026'),
        })
        expect(row(model, 'transaction.officialReceipt.pdf.type')).toBe('transaction.type.bank_withdraw')
        expect(row(model, 'transaction.officialReceipt.pdf.status')).toBe('common.status.completed')
        expect(row(model, 'transaction.rows.to')).toBe('kkonrad')
        expect(row(model, 'transaction.rows.fee')).toBe('0.5')
        expect(row(model, 'transaction.rows.txId')).toBe(baseTx.txHash)
        // bank_withdraw carries its transfer reference
        expect(row(model, 'transaction.rows.transferId')).toBe(baseTx.id)
        expect(row(model, 'transaction.officialReceipt.reference')).toBe(baseTx.id)
        expect(labels(model).slice(-3)).toEqual([
            'transaction.rows.txId',
            'transaction.rows.transferId',
            'transaction.officialReceipt.reference',
        ])
        expect(labels(model)).not.toContain('transaction.rows.pointsEarned')
    })

    test('completed OFFRAMP uses one Date field at the top', () => {
        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('2026')
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
        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('2026')
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
            withOverrides(
                {
                    bankAccountDetails: { identifier: 'ES9121000418450200051332', type: 'BANK_IBAN' },
                    currency: { amount: '113250.75', code: 'ARS' },
                },
                { receipt: { exchange_rate: '902.4' } }
            ),
            t,
            'en'
        )
        const value = row(model, 'IBAN')
        expect(value).toBeDefined()
        expect(value).not.toBe('ES9121000418450200051332')
        expect(value).toContain('1332')
        expect(labels(model).slice(-5)).toEqual([
            'IBAN',
            'common.exchangeRate',
            'transaction.rows.txId',
            'transaction.rows.transferId',
            'transaction.officialReceipt.reference',
        ])
    })

    test('keeps a reference when transaction and transfer ids are unavailable', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ direction: 'card', txHash: undefined }, { transactionCardType: 'card_payment' }),
            t,
            'en'
        )

        expect(labels(model)).not.toContain('transaction.rows.txId')
        expect(labels(model)).not.toContain('transaction.rows.transferId')
        expect(model.rows.at(-1)).toEqual({
            label: 'transaction.officialReceipt.reference',
            value: baseTx.id,
        })
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
        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('2026')
        expect(labels(model)).not.toContain('transaction.rows.cancelled')
        expect(labels(model)).not.toContain('transaction.rows.fee')
        expect(labels(model)).not.toContain('transaction.rows.transferId')
        expect(labels(model)).not.toContain('IBAN')
        expect(model.rows.at(-1)).toEqual({
            label: 'transaction.officialReceipt.reference',
            value: baseTx.id,
        })
    })

    test('memo renders as the comment row, memoKey preferred over raw memo', () => {
        const withMemo = buildReceiptPdfModel(withOverrides({ memo: 'invoice #42' }), t, 'en')
        expect(row(withMemo, 'common.comment')).toBe('invoice #42')

        const withKey = buildReceiptPdfModel(withOverrides({ memo: 'x', memoKey: 'memoTestDeposit' }), t, 'en')
        expect(row(withKey, 'common.comment')).toBe('transaction.memoTestDeposit')
    })

    test('goal-less request pot renders the collected total, not its zero goal', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    amount: 0,
                    isRequestPotLink: true,
                    totalAmountCollected: 47.25,
                    status: 'closed',
                },
                { kind: 'P2P_REQUEST_FULFILL' }
            ),
            t,
            'en'
        )

        expect(model.amountDisplay).toBe('$47.25')
    })

    test('goal-set request pot renders the collected total, not its requested goal', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    amount: 100,
                    isRequestPotLink: true,
                    totalAmountCollected: 40,
                    status: 'closed',
                },
                { kind: 'P2P_REQUEST_FULFILL' }
            ),
            t,
            'en'
        )

        expect(model.amountDisplay).toBe('$40.00')
    })

    test('claimed send link uses its claim timestamp as Date', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    direction: 'send',
                    completedAt: '2026-08-20T15:22:00.000Z',
                    claimedAt: '2026-08-22T09:30:00.000Z',
                },
                { kind: 'SEND_LINK' }
            ),
            t,
            'en'
        )

        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('August 22, 2026')
    })

    test('closed request pot uses its closure timestamp as Date', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    amount: 100,
                    isRequestPotLink: true,
                    totalAmountCollected: 40,
                    status: 'closed',
                    cancelledDate: '2026-08-23T17:45:00.000Z',
                },
                { kind: 'P2P_REQUEST_FULFILL' }
            ),
            t,
            'en'
        )

        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('August 23, 2026')
    })

    // The screen hides the row when the shared rule yields no date, so the
    // document leaves it out too rather than printing a dash at a reader.
    test('an unreadable issuance date drops the row instead of printing a dash', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ status: 'pending', createdAt: 'not-a-date', completedAt: undefined, date: 'not-a-date' }),
            t,
            'en'
        )
        expect(labels(model)).not.toContain('transaction.officialReceipt.issuedOn')
    })

    // A refund and a spend of the same value printed an identical headline.
    test('the headline carries the direction sign', () => {
        const sent = buildReceiptPdfModel(withOverrides({ direction: 'send', amount: 12.5 }), t, 'en')
        const received = buildReceiptPdfModel(withOverrides({ direction: 'receive', amount: 12.5 }), t, 'en')

        expect(sent.amountDisplay).toBe('-$12.5')
        expect(received.amountDisplay).toBe('+$12.5')
    })

    // A pot reports what it collected, and a collected total has no direction.
    test('a request pot headline carries no sign', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                { amount: 100, isRequestPotLink: true, totalAmountCollected: 40, status: 'closed' },
                { kind: 'P2P_REQUEST_FULFILL' }
            ),
            t,
            'en'
        )

        expect(model.amountDisplay).toBe('$40.00')
    })
})

describe('buildReceiptPdfModel — app locales', () => {
    // the leading row is the issuance date since TASK-22452 (relabelled from
    // the generic Date — same status-branched source timestamp)
    const localizedCopy: ReadonlyArray<[AppLocale, string, string, string]> = [
        ['en', 'Transaction Receipt', 'Issued on', 'Reference'],
        ['es-419', 'Comprobante de la transacción', 'Fecha de emisión', 'Referencia'],
        ['es-AR', 'Comprobante de la transacción', 'Fecha de emisión', 'Referencia'],
        ['pt-BR', 'Comprovante da transação', 'Emitido em', 'Referência'],
    ]

    test('covers every supported app locale', () => {
        expect(localizedCopy.map(([locale]) => locale)).toEqual(APP_LOCALES)
    })

    test.each(localizedCopy)('renders receipt copy in %s', async (locale, title, dateLabel, referenceLabel) => {
        const messages = await loadMessages(locale)
        const translate = createTranslator({ locale, messages }) as PdfTranslate
        const model = buildReceiptPdfModel(baseTx, translate, locale)

        expect(model.title).toBe(title)
        expect(model.rows[0].label).toBe(dateLabel)
        expect(model.rows.at(-1)?.label).toBe(referenceLabel)
    })
})

// representative coverage for the authenticated all-kinds pdf that #3159
// introduced (TASK-22452 item 4): a card spend, a p2p transfer and a
// send-link claim each produce a sane model — no access-boundary changes.
describe('buildReceiptPdfModel — representative private kinds', () => {
    test('card spend: fx and status rows, no bank transfer id', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    direction: 'qr_payment',
                    userName: 'Aerolineas Argentinas',
                    txHash: undefined,
                    currency: { code: 'ARS', amount: '18000' },
                },
                {
                    kind: 'CARD_SPEND_CLEAR',
                    transactionCardType: 'qr_payment',
                    cardPayment: {},
                    receipt: { exchange_rate: '1412' },
                }
            ),
            t,
            'en'
        )
        expect(model.rows[0].label).toBe('transaction.officialReceipt.issuedOn')
        expect(row(model, 'transaction.officialReceipt.pdf.status')).toBe('common.status.completed')
        expect(row(model, 'transaction.rows.to')).toBe('Aerolineas Argentinas')
        expect(row(model, 'common.exchangeRate')).toContain('ARS')
        expect(labels(model)).not.toContain('transaction.rows.transferId')
        expect(model.rows.at(-1)?.label).toBe('transaction.officialReceipt.reference')
    })

    test('p2p direct transfer: counterparty, memo, reference — no bank rows', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                { direction: 'send', userName: 'nacho', memo: 'gracias!', txHash: undefined },
                { kind: 'DIRECT_TRANSFER', transactionCardType: 'send' }
            ),
            t,
            'en'
        )
        expect(model.rows[0].label).toBe('transaction.officialReceipt.issuedOn')
        expect(row(model, 'transaction.rows.to')).toBe('nacho')
        expect(row(model, 'common.comment')).toBe('gracias!')
        expect(labels(model)).not.toContain('transaction.rows.transferId')
        expect(model.rows.at(-1)?.label).toBe('transaction.officialReceipt.reference')
    })

    test('send-link claim: recipient side reads From and dates from the claim', () => {
        const model = buildReceiptPdfModel(
            withOverrides(
                {
                    direction: 'claim_external',
                    userName: 'kkonrad',
                    txHash: undefined,
                    completedAt: undefined,
                    claimedAt: '2026-08-22T10:00:00.000Z',
                },
                {
                    kind: 'SEND_LINK_CLAIM',
                    transactionCardType: 'receive',
                    originalUserRole: EHistoryUserRole.RECIPIENT,
                }
            ),
            t,
            'en'
        )
        expect(row(model, 'transaction.officialReceipt.issuedOn')).toContain('August 22, 2026')
        expect(row(model, 'transaction.officialReceipt.pdf.from')).toBe('kkonrad')
        expect(model.rows.at(-1)?.label).toBe('transaction.officialReceipt.reference')
    })
})

describe('buildReceiptPdfModel — bank deposit sender reference', () => {
    // Free text a third party typed, in a document the owner shares onward.
    test('the payer reference stays out of the document, whatever it says', () => {
        const model = buildReceiptPdfModel(
            withOverrides({ direction: 'bank_deposit' }, { kind: 'ONRAMP', senderReference: 'INVOICE 4471' }),
            t,
            'en'
        )
        expect(labels(model)).not.toContain('transaction.rows.senderReference')
        expect(JSON.stringify(model)).not.toContain('INVOICE 4471')
    })
})
