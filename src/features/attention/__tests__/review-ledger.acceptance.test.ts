/** UI Jest environment; direct production imports, no subject adapter. */
import { describe, expect, it } from '@jest/globals'
import { sanitizeEntry } from '@/features/attention/ledger'
import { isSilenced } from '@/features/attention/decide'
import type { AttentionAsk, JourneyState } from '@/features/attention/types'

describe('B3 direct UI ledger normalization', () => {
    const versions = [
        ...[199, 200, 201, 512].map((length) => 'v'.repeat(length)),
        ...[99, 100, 101, 201].map((length) => '🦊'.repeat(length)),
        'v-é-e\u0301-日本語',
        'v1#fragment',
        'https://example.invalid/terms?v=2#access_token=acceptance-secret-447',
    ]
    it.each(versions)('B3.D1 sanitizing a persisted round-trip is stable for corpus case %#', (version) => {
        const raw = {
            version,
            dismissedAt: '2026-11-02T12:00:00.000Z',
            updatedAt: '2026-11-02T12:00:00.000Z',
        }
        const first = sanitizeEntry(raw)
        expect(first).toBeTruthy()
        expect(first?.dismissedAt).toBe(raw.dismissedAt)
        const second = sanitizeEntry(JSON.parse(JSON.stringify(first)))
        expect(second).toEqual(first)
        expect(JSON.stringify(second)).not.toContain('acceptance-secret-447')
    })

    it.each(versions)(
        'B3.D2 persisted normalization does not re-arm a dismissal for the same raw version, case %#',
        (version) => {
            const now = Date.parse('2026-11-03T12:00:00.000Z')
            const entry = sanitizeEntry({
                version,
                dismissedAt: '2026-11-02T12:00:00.000Z',
                updatedAt: '2026-11-02T12:00:00.000Z',
            })
            expect(entry).toBeTruthy()
            const ask: AttentionAsk = {
                id: 'balance-backup',
                tier: 2,
                rank: 0,
                surfaces: ['zone'],
                eligible: () => 'show',
                version: () => version,
                policy: { expiryDays: 21 },
                analyticsKey: 'acceptance-balance',
            }
            // This pure boundary needs only state.now; version is constant, not state-derived.
            const state = { now } as JourneyState
            expect(isSilenced(ask, entry, state)).toBe(true)
            const persisted = sanitizeEntry(JSON.parse(JSON.stringify(entry)))
            expect(isSilenced(ask, persisted, state)).toBe(true)
        }
    )
})
