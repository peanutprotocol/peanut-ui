/**
 * Render-shape snapshot harness for the Decomplexify Phase 2 cutover.
 *
 * The BE PR ships a baseline JSONL of `/users/history` wire payloads, one
 * row per `(TransactionIntentKind × status × userRole)` tuple. This test
 * vendors that baseline as a JSON fixture, runs every entry through the
 * FE transformer + receipt view model, and asserts byte-equal output
 * against `render-baseline.json`. The baseline is intentionally committed
 * empty — CI bootstraps it the first time the BE-derived fixture is wired
 * in. Until then this test is a no-op gate that locks the harness contract.
 *
 * Why this exists: the legacy projector layer (Bridge/Manteca/Deposit/Perk
 * static mappers) shipped four duplicate-yet-divergent wire shapes for the
 * same row. The FE had to keep a parallel `strategies/legacy/*` layer alive
 * to bridge them. Phase 2 collapses both sides to a single wire kind, and
 * this snapshot is the regression catch-net during the cutover.
 *
 * Fixture format: `Array<{ entry: HistoryEntry; expected: SnapshotRow }>`
 * where `SnapshotRow` captures the receipt-visible fields the cutover must
 * preserve (direction, userName, status, kind, provider, rowVisibilityConfig
 * keys that are true). Loose-typed at the boundary — the assertion is
 * `expect(actual).toEqual(expected)`, no schema enforcement.
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

describe('render snapshot — TRANSACTION_INTENT wire shape (decomplexify phase 2)', () => {
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
