import { endOfLocalDay, presetDates, startOfLocalDay, toLocalDateString, LOCAL_DATE_RE } from '../historyRange.utils'

describe('historyRange.utils', () => {
    const today = new Date(2026, 8, 15) // 2026-09-15 local

    it('round-trips local date strings', () => {
        expect(toLocalDateString(today)).toBe('2026-09-15')
        expect(startOfLocalDay('2026-09-15').getTime()).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).getTime())
        expect(endOfLocalDay('2026-09-15').getTime()).toBe(new Date(2026, 8, 15, 23, 59, 59, 999).getTime())
        expect(LOCAL_DATE_RE.test('2026-09-15')).toBe(true)
        expect(LOCAL_DATE_RE.test('2026-9-15')).toBe(false)
    })

    it('computes rolling presets inclusive of today', () => {
        expect(presetDates('allTime', today)).toBeNull()
        expect(presetDates('last7d', today)).toEqual({ from: '2026-09-09', to: '2026-09-15' })
        expect(presetDates('last30d', today)).toEqual({ from: '2026-08-17', to: '2026-09-15' })
        expect(presetDates('last3m', today)).toEqual({ from: '2026-06-15', to: '2026-09-15' })
        expect(presetDates('ytd', today)).toEqual({ from: '2026-01-01', to: '2026-09-15' })
    })

    it('clamps month arithmetic to the target month instead of rolling over', () => {
        // May 31 − 3 months would roll to Mar 3 with naive Date math
        expect(presetDates('last3m', new Date(2026, 4, 31))).toEqual({ from: '2026-02-28', to: '2026-05-31' })
        // year boundary
        expect(presetDates('last6m', new Date(2026, 1, 10))).toEqual({ from: '2025-08-10', to: '2026-02-10' })
    })
})
