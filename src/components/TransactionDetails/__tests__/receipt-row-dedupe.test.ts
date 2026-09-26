/**
 * Every wire fixture, run through the transformer and the view model: no
 * receipt prints one fact twice. The rules live in the view model and the
 * shared helpers (receiptStatusDate, receipt-conversion.utils); this sweep
 * checks they hold for every kind × status × role the API sends.
 *
 * Dividers need no check here: the details card draws them with `divide-y`,
 * which never puts a rule after the last row, whichever row that is.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderHook } from '@testing-library/react'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { isSameReceiptMinute, receiptStatusDate } from '../transaction-details.utils'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

type Case = { name: string; entry: HistoryEntry }

const baseline = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'render-baseline.json'), 'utf8')) as Case[]

// The baseline carries placeholder timestamps, so on its own it never reaches
// the date rules. These entries carry real timestamps and USD amounts.
const dated = (name: string, overrides: Partial<HistoryEntry>): Case => ({
    name,
    entry: {
        uuid: `dated-${name}`,
        type: 'TRANSACTION_INTENT',
        timestamp: '2026-09-10T10:00:00.000Z',
        createdAt: '2026-09-10T10:00:00.000Z',
        amount: '24.32',
        tokenSymbol: 'USDC',
        status: 'COMPLETED',
        userRole: 'SENDER',
        ...overrides,
    } as unknown as HistoryEntry,
})

const bankSender = { identifier: '', type: 'sepa', isUser: false }
const eur = { amount: '21.33', code: 'EUR' }
const eurReceipt = { exchange_rate: '0.8769' }

const datedCases: Case[] = [
    dated('offramp-completed-same-minute', {
        completedAt: '2026-09-10T10:00:40.000Z',
        extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', usdAmount: '24.32' },
    }),
    dated('offramp-completed-next-day', {
        completedAt: '2026-09-11T08:00:00.000Z',
        currency: eur,
        extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', usdAmount: '24.32', receipt: eurReceipt },
    }),
    dated('direct-transfer-completed-same-minute', {
        completedAt: '2026-09-10T10:00:02.000Z',
        extraData: { kind: 'DIRECT_TRANSFER', usdAmount: '24.32' },
    }),
    dated('va-deposit-completed', {
        userRole: 'RECIPIENT',
        completedAt: '2026-09-10T12:00:00.000Z',
        currency: eur,
        senderAccount: { ...bankSender, fullName: 'Ana Pérez' },
        extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '24.32', receipt: eurReceipt },
    }),
    dated('va-deposit-completed-no-name', {
        userRole: 'RECIPIENT',
        completedAt: '2026-09-10T12:00:00.000Z',
        senderAccount: bankSender,
        extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '24.32' },
    }),
    dated('manteca-deposit-completed', {
        userRole: 'RECIPIENT',
        completedAt: '2026-09-10T12:00:00.000Z',
        currency: { amount: '30000', code: 'ARS' },
        senderAccount: { identifier: 'Manteca Deposit', type: 'BANK_CBU', isUser: false },
        extraData: { kind: 'ONRAMP', provider: 'MANTECA', usdAmount: '24.32' },
    }),
]

const cases = [...baseline, ...datedCases]

const render = (entry: HistoryEntry) => {
    const { transactionDetails } = mapTransactionDataForDrawer(entry)
    const { result } = renderHook(() => useReceiptViewModel(transactionDetails, { isPublic: false }))
    return { transaction: transactionDetails, rows: result.current.rowVisibilityConfig }
}

describe('receipt rows — no fact printed twice, across every wire fixture', () => {
    it('Created and the status row never print the same minute', () => {
        for (const c of cases) {
            const { transaction, rows } = render(c.entry)
            if (!rows.createdAt || !rows.statusDate) continue
            const statusDate = receiptStatusDate(transaction)!
            expect({
                name: c.name,
                same: isSameReceiptMinute(new Date(transaction.createdAt!), statusDate.date),
            }).toEqual({ name: c.name, same: false })
        }
    })

    it('the dated entries reach both date outcomes', () => {
        const outcomes = datedCases.map((c) => render(c.entry).rows)
        expect(outcomes.some((rows) => rows.statusDate && !rows.createdAt)).toBe(true)
        expect(outcomes.some((rows) => rows.statusDate && rows.createdAt)).toBe(true)
    })

    it('a From row shows on Bridge deposits into bank details only, never on Manteca deposits', () => {
        const from = Object.fromEntries(datedCases.map((c) => [c.name, render(c.entry).rows.from]))
        expect(from['va-deposit-completed']).toBe(true)
        expect(from['va-deposit-completed-no-name']).toBe(true)
        expect(from['manteca-deposit-completed']).toBe(false)
        expect(from['offramp-completed-next-day']).toBe(false)
    })

    it('a settled conversion never adds a separate Exchange rate row', () => {
        for (const c of cases) {
            const { transaction, rows } = render(c.entry)
            if (transaction.status !== 'completed' || !rows.conversion) continue
            expect({ name: c.name, exchangeRate: rows.exchangeRate }).toEqual({ name: c.name, exchangeRate: false })
        }
    })

    it('every fixture with a readable timestamp still carries a date row', () => {
        for (const c of cases) {
            const { transaction, rows } = render(c.entry)
            if (!receiptStatusDate(transaction)) continue
            expect({ name: c.name, dated: rows.createdAt || rows.statusDate }).toEqual({ name: c.name, dated: true })
        }
    })
})
