/**
 * The details card underlines every row with a dashed rule and drops it on the
 * last one, so the rule doesn't double up with the card's own black border.
 *
 * Since TASK-22452 the card always ends on the document rows (an optional
 * reference, then issued-on): issued-on renders directly in the card with no
 * runtime gate, so
 * a delegated sub-component row (MantecaDepositInfo, BridgeDepositInstructions)
 * can never be the DOM's last row and the `[&>*:last-child]:border-b-0`
 * container rule is only a belt for the delegated rows' own internals. If a
 * future change removes or gates the document rows, this test is the thing
 * that says the trailing-divider analysis must be redone.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderHook } from '@testing-library/react'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { transactionDetailsRowKeys } from '../transaction-details.utils'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

type Case = { name: string; entry: HistoryEntry }

const cases = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'render-baseline.json'), 'utf8')) as Case[]

const visibleRows = (entry: HistoryEntry): string[] => {
    const { transactionDetails } = mapTransactionDataForDrawer(entry)
    const { result } = renderHook(() => useReceiptViewModel(transactionDetails, { isPublic: false }))
    return transactionDetailsRowKeys.filter((key) => result.current.rowVisibilityConfig[key])
}

describe('receipt details card — trailing dashed rule', () => {
    it('every fixture ends on the ungated issued-on document row', () => {
        for (const c of cases) {
            const rows = visibleRows(c.entry)
            expect({ name: c.name, last: rows[rows.length - 1] }).toEqual({ name: c.name, last: 'issuedOn' })
        }
    })

    it('the receipt-reference row, when it shows, sits directly before issued-on', () => {
        // The row is gated now: it drops out when the Transfer ID or the
        // Transaction ID row already prints the same id. issued-on stays
        // ungated, so the trailing-rule analysis above still holds.
        for (const c of cases) {
            const rows = visibleRows(c.entry)
            if (!rows.includes('reference')) continue
            expect({ name: c.name, secondLast: rows[rows.length - 2] }).toEqual({
                name: c.name,
                secondLast: 'reference',
            })
        }
    })

    it('a bank rail never prints its id twice — Transfer ID wins, reference drops out', () => {
        const bankRails = cases.filter((c) => visibleRows(c.entry).includes('transferId'))
        expect(bankRails.length).toBeGreaterThan(0)
        for (const c of bankRails) {
            expect({ name: c.name, reference: visibleRows(c.entry).includes('reference') }).toEqual({
                name: c.name,
                reference: false,
            })
        }
    })
})
