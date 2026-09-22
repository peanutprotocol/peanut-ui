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

const cases = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'render-baseline.json'), 'utf8')) as Case[]

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
