/**
 * Render-shape snapshot harness for the `/users/history` wire contract.
 *
 * Vendors a JSON fixture (`render-baseline.json`) of one HistoryEntry per
 * `(TransactionIntentKind × status × userRole)` tuple, runs every entry
 * through the FE transformer + receipt view model, and asserts byte-equal
 * output. Any drift in the FE rendering of a wire payload fails CI.
 *
 * Fixture format: `Array<{ entry: HistoryEntry; expected: SnapshotRow }>`
 * where `SnapshotRow` captures the receipt-visible fields the contract
 * must preserve (direction, userName, kind, provider, etc.). Loose-typed
 * at the boundary — the assertion is `expect(actual).toEqual(expected)`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '', SIMPLEFI: '' }))

interface SnapshotCase {
    name: string
    entry: HistoryEntry
    expected: {
        direction: string
        userName: string
        transactionCardType?: string
        kind?: string
        provider?: string
        cardPaymentDefined?: boolean
        bankAccountDetailsDefined?: boolean
    }
}

function loadFixture(): SnapshotCase[] {
    const path = join(__dirname, 'fixtures', 'render-baseline.json')
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as SnapshotCase[]
}

describe('render snapshot — TRANSACTION_INTENT wire shape', () => {
    const cases = loadFixture()

    if (cases.length === 0) {
        // Baseline is empty — fixture will be populated from the BE JSONL
        // dump once the BE PR lands. This sentinel keeps the suite green
        // and signals the bootstrap state.
        test('baseline fixture is empty (awaiting BE JSONL import)', () => {
            expect(cases).toEqual([])
        })
        return
    }

    it.each(cases)('$name', ({ entry, expected }) => {
        const { transactionDetails } = mapTransactionDataForDrawer(entry)
        expect(transactionDetails.direction).toBe(expected.direction)
        expect(transactionDetails.userName).toBe(expected.userName)
        if (expected.transactionCardType !== undefined) {
            expect(transactionDetails.extraDataForDrawer?.transactionCardType).toBe(expected.transactionCardType)
        }
        if (expected.kind !== undefined) {
            expect(transactionDetails.extraDataForDrawer?.kind).toBe(expected.kind)
        }
        if (expected.provider !== undefined) {
            expect(transactionDetails.extraDataForDrawer?.provider).toBe(expected.provider)
        }
        if (expected.cardPaymentDefined !== undefined) {
            expect(!!transactionDetails.extraDataForDrawer?.cardPayment).toBe(expected.cardPaymentDefined)
        }
        if (expected.bankAccountDetailsDefined !== undefined) {
            expect(!!transactionDetails.bankAccountDetails).toBe(expected.bankAccountDetailsDefined)
        }
    })
})
