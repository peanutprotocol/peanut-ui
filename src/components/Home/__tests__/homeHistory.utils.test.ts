/**
 * Home Activity list logic (TASK-21671 regression guards).
 *
 * The widget merges fetched history with synthetic rows (badges, KYC,
 * card-unlock) and live websocket entries, then shows the newest
 * RECENT_ACTIVITY_LIMIT. Fetching exactly RECENT_ACTIVITY_LIMIT rows let
 * older synthetic rows evict real recent transactions from the final
 * slice — the fetch limit must carry headroom, and the sort must always
 * put the newest items first regardless of merge order.
 */
import {
    RECENT_ACTIVITY_FETCH_LIMIT,
    RECENT_ACTIVITY_LIMIT,
    selectRecentEntries,
    upsertEntryByUuid,
} from '../homeHistory.utils'

const entry = (uuid: string, timestamp: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    timestamp,
    ...extra,
})

describe('selectRecentEntries', () => {
    it('keeps the newest RECENT_ACTIVITY_LIMIT entries, newest first', () => {
        const entries = Array.from({ length: 8 }, (_, i) => entry(`tx-${i}`, `2026-08-${10 + i}T12:00:00Z`))

        const result = selectRecentEntries(entries)

        expect(result).toHaveLength(RECENT_ACTIVITY_LIMIT)
        expect(result.map((e) => e.uuid)).toEqual(['tx-7', 'tx-6', 'tx-5', 'tx-4', 'tx-3'])
    })

    it('old synthetic rows do not evict newer real transactions', () => {
        const realTxs = Array.from({ length: 5 }, (_, i) => entry(`tx-${i}`, `2026-08-${20 + i}T12:00:00Z`))
        const syntheticRows = [
            entry('badge-1', '2026-05-01T00:00:00Z', { isBadge: true }),
            entry('kyc-1', '2026-04-01T00:00:00Z', { isKyc: true }),
            entry('card-unlock', '2026-03-01T00:00:00Z'),
        ]

        // merge order mirrors the component: fetched first, synthetics appended
        const result = selectRecentEntries([...realTxs, ...syntheticRows])

        expect(result.map((e) => e.uuid)).toEqual(['tx-4', 'tx-3', 'tx-2', 'tx-1', 'tx-0'])
    })

    it('a synthetic row newer than a transaction takes its chronological slot', () => {
        const result = selectRecentEntries([
            entry('tx-old', '2026-08-01T12:00:00Z'),
            entry('badge-new', '2026-08-02T12:00:00Z', { isBadge: true }),
        ])

        expect(result.map((e) => e.uuid)).toEqual(['badge-new', 'tx-old'])
    })

    it('accepts Date timestamps and a custom limit, without mutating the input', () => {
        const input = [entry('a', '2026-08-01T00:00:00Z'), { uuid: 'b', timestamp: new Date('2026-08-02T00:00:00Z') }]
        const snapshot = [...input]

        const result = selectRecentEntries(input, 1)

        expect(result.map((e) => e.uuid)).toEqual(['b'])
        expect(input).toEqual(snapshot)
    })

    it('the fetch limit carries headroom over the display limit', () => {
        expect(RECENT_ACTIVITY_FETCH_LIMIT).toBeGreaterThan(RECENT_ACTIVITY_LIMIT)
    })
})

describe('upsertEntryByUuid', () => {
    it('replaces an existing entry in place (websocket update of a fetched row)', () => {
        const entries = [entry('a', '2026-08-01T00:00:00Z', { status: 'PENDING' })]

        upsertEntryByUuid(entries, entry('a', '2026-08-01T00:00:00Z', { status: 'COMPLETED' }))

        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({ uuid: 'a', status: 'COMPLETED' })
    })

    it('appends a new entry when the uuid is unknown', () => {
        const entries = [entry('a', '2026-08-01T00:00:00Z')]

        upsertEntryByUuid(entries, entry('b', '2026-08-02T00:00:00Z'))

        expect(entries.map((e) => e.uuid)).toEqual(['a', 'b'])
    })
})
