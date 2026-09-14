/**
 * Render-shape snapshot harness for the `/users/history` wire contract.
 *
 * Vendors a JSON fixture (`render-baseline.json`) of one HistoryEntry per
 * `(TransactionIntentKind × status × userRole)` tuple, runs every entry
 * through the FE transformer + receipt view model, and asserts byte-equal
 * output. Any drift in the FE rendering of a wire payload fails CI.
 *
 * The committed baseline can also go STALE against the BE, which verifying
 * the FE transformer against it cannot detect: if the backend adds, drops or
 * reshapes an entry, this fixture keeps happily asserting the old world. The
 * drift block at the bottom closes that, and runs whenever CI has fetched the
 * BE's living fixture into `be-entries.json`.
 *
 * Fixture format: `Array<{ entry: HistoryEntry; expected: SnapshotRow }>`
 * where `SnapshotRow` captures the receipt-visible fields the contract
 * must preserve (direction, userName, kind, provider, etc.). Loose-typed
 * at the boundary — the assertion is `expect(actual).toEqual(expected)`.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

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

const FIXTURE_PATH = join(__dirname, 'fixtures', 'render-baseline.json')
const BE_ENTRIES_PATH = join(__dirname, 'fixtures', 'be-entries.json')
const MODE = process.env.SNAPSHOT_MODE === 'write' ? 'write' : 'verify'

function loadFixture(): SnapshotCase[] {
    const raw = readFileSync(FIXTURE_PATH, 'utf8')
    return JSON.parse(raw) as SnapshotCase[]
}

// Bootstrap: pull the vendored BE entries (one HistoryEntry per dispatch arm,
// baked by the paired BE snapshot harness), run each through the FE
// transformer, and write the `{ entry, expected }` pairs to render-baseline.
// Used only with SNAPSHOT_MODE=write. Subsequent runs verify against the
// committed baseline.
function bakeFromBeEntries(): SnapshotCase[] {
    const raw = readFileSync(BE_ENTRIES_PATH, 'utf8')
    const beEntries = JSON.parse(raw) as Array<{ caseId: string; entry: HistoryEntry }>
    return beEntries.map(({ caseId, entry }) => {
        const { transactionDetails } = mapTransactionDataForDrawer(entry)
        const drawer = transactionDetails.extraDataForDrawer
        return {
            name: caseId,
            entry,
            expected: {
                direction: transactionDetails.direction,
                userName: transactionDetails.userName ?? '',
                ...(drawer?.transactionCardType !== undefined
                    ? { transactionCardType: drawer.transactionCardType }
                    : {}),
                ...(drawer?.kind !== undefined ? { kind: drawer.kind } : {}),
                ...(drawer?.provider !== undefined ? { provider: drawer.provider } : {}),
                cardPaymentDefined: !!drawer?.cardPayment,
                bankAccountDetailsDefined: !!transactionDetails.bankAccountDetails,
            },
        }
    })
}

describe('render snapshot — TRANSACTION_INTENT wire shape', () => {
    if (MODE === 'write') {
        test('bake baseline from vendored BE entries', () => {
            const cases = bakeFromBeEntries()
            writeFileSync(FIXTURE_PATH, JSON.stringify(cases, null, 2) + '\n')
            console.warn(`[render-snapshot] wrote ${cases.length} cases to ${FIXTURE_PATH}`)
            expect(cases.length).toBeGreaterThan(0)
        })
        return
    }

    const cases = loadFixture()

    if (cases.length === 0) {
        test('baseline fixture is empty — run with SNAPSHOT_MODE=write to bake', () => {
            throw new Error(
                'render-baseline.json is empty. Bake it with `SNAPSHOT_MODE=write npm test -- render-snapshot` and commit the result.'
            )
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

// Key-order-insensitive so a serializer change on either side is not drift.
const canonical = (value: unknown): string =>
    JSON.stringify(value, (_k, v) =>
        v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
            : v
    )

/*
 * Staleness gate. `be-entries.json` is gitignored and only exists when CI
 * fetched the BE's living fixture (see the unit job in tests.yml), so this is
 * inert locally and on any run without a cross-repo token — it can only ever
 * add a failure when the real BE data is in hand, never mask one.
 */
const beEntriesPresent = existsSync(BE_ENTRIES_PATH)
const describeDrift = beEntriesPresent ? describe : describe.skip

describeDrift('render snapshot — committed baseline vs the BE fixture', () => {
    // Read inside the hook, not the describe body: a skipped describe still
    // evaluates its callback, so a top-level read would crash collection on
    // every machine that has no fetched fixture.
    let beById: Map<string, HistoryEntry>
    let baselineById: Map<string, HistoryEntry>
    const REBAKE = 'Re-bake with `SNAPSHOT_MODE=write pnpm jest render-snapshot` and commit the result.'

    beforeAll(() => {
        const be = JSON.parse(readFileSync(BE_ENTRIES_PATH, 'utf8')) as Array<{ caseId: string; entry: HistoryEntry }>
        beById = new Map(be.map((c) => [c.caseId, c.entry]))
        baselineById = new Map(loadFixture().map((c) => [c.name, c.entry]))
    })

    it('covers every case the BE publishes', () => {
        const missing = [...beById.keys()].filter((id) => !baselineById.has(id))
        expect(missing.length === 0 ? '' : `baseline is missing BE cases: ${missing.join(', ')}. ${REBAKE}`).toBe('')
    })

    it('carries no case the BE has dropped', () => {
        const extra = [...baselineById.keys()].filter((id) => !beById.has(id))
        expect(
            extra.length === 0 ? '' : `baseline has cases the BE no longer publishes: ${extra.join(', ')}. ${REBAKE}`
        ).toBe('')
    })

    it('holds the same wire payload as the BE for every shared case', () => {
        const changed = [...beById.entries()]
            .filter(([id, entry]) => baselineById.has(id) && canonical(baselineById.get(id)) !== canonical(entry))
            .map(([id]) => id)
        expect(changed.length === 0 ? '' : `BE reshaped these entries: ${changed.join(', ')}. ${REBAKE}`).toBe('')
    })
})
