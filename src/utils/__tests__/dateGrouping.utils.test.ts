/**
 * getDateGroup / getDateGroupKey drive the "Today / Yesterday / <date>"
 * section headers on /history and /notifications. Both classify by the
 * viewer's LOCAL calendar day; the group keys must agree with that (they
 * used to be derived via toISOString, which shifted late-evening entries
 * into the wrong month header for UTC-negative viewers).
 *
 * Local dates are built from local components (new Date(y, m, d)) so the
 * tests hold in any TZ; the UTC-rollover cases mock the local getters to
 * simulate a UTC-3 viewer deterministically (process.env.TZ is unreliable
 * under jest — its env copy doesn't retrigger tzset).
 */
import { DateGroup, getDateGroup, getDateGroupKey } from '../dateGrouping.utils'

/**
 * a Date whose UTC value rolled into the next day/month but whose LOCAL
 * view reads as the given calendar day — what a UTC-negative viewer sees
 * for a late-evening timestamp.
 */
function utcRolledOverDate(iso: string, local: { year: number; month: number; day: number }): Date {
    const date = new Date(iso)
    jest.spyOn(date, 'getFullYear').mockReturnValue(local.year)
    jest.spyOn(date, 'getMonth').mockReturnValue(local.month)
    jest.spyOn(date, 'getDate').mockReturnValue(local.day)
    return date
}

describe('getDateGroup', () => {
    // local "now": March 9, 2026, 23:00
    const today = new Date(2026, 2, 9, 23, 0, 0)

    it('groups a late-evening timestamp into the LOCAL day (UTC already rolled over)', () => {
        // 22:30 local (UTC-3) on March 9 = 01:30 UTC on March 10
        const lateEvening = utcRolledOverDate('2026-03-10T01:30:00Z', { year: 2026, month: 2, day: 9 })
        expect(getDateGroup(lateEvening, today)).toBe(DateGroup.Today)
    })

    it('classifies yesterday and the last-7-days window by local days', () => {
        expect(getDateGroup(new Date(2026, 2, 8, 1, 0), today)).toBe(DateGroup.Yesterday)
        expect(getDateGroup(new Date(2026, 2, 3, 12, 0), today)).toBe(DateGroup.Last7Days)
    })

    it('treats a future-dated entry as Today (most recent bucket), not as days-ago', () => {
        // Math.abs() used to make a +6-days entry look 6 days old (Last7Days)
        expect(getDateGroup(new Date(2026, 2, 15, 12, 0), today)).toBe(DateGroup.Today)
        // even across a month boundary
        expect(getDateGroup(new Date(2026, 3, 2, 12, 0), today)).toBe(DateGroup.Today)
    })

    it('puts the previous calendar month into LastMonth across a month boundary', () => {
        expect(getDateGroup(new Date(2026, 1, 28, 12, 0), today)).toBe(DateGroup.LastMonth)
    })

    it('January classifies December of the previous year as LastMonth, not OlderYear', () => {
        const january = new Date(2026, 0, 20, 12, 0)
        expect(getDateGroup(new Date(2025, 11, 10, 12, 0), january)).toBe(DateGroup.LastMonth)
        // anything older in the previous year is still OlderYear
        expect(getDateGroup(new Date(2025, 9, 10, 12, 0), january)).toBe(DateGroup.OlderYear)
    })

    it('same year / older month → Older; other years → OlderYear', () => {
        expect(getDateGroup(new Date(2026, 0, 5, 12, 0), today)).toBe(DateGroup.Older)
        expect(getDateGroup(new Date(2024, 5, 5, 12, 0), today)).toBe(DateGroup.OlderYear)
    })
})

describe('getDateGroupKey', () => {
    it('keys month groups by the LOCAL month, not the UTC month', () => {
        // 23:30 local (UTC-3) on Jan 31 = 02:30 UTC on Feb 1 — key must stay in January
        const endOfJanuary = utcRolledOverDate('2026-02-01T02:30:00Z', { year: 2026, month: 0, day: 31 })
        expect(getDateGroupKey(endOfJanuary, DateGroup.Older)).toBe('2026-01')
        expect(getDateGroupKey(endOfJanuary, DateGroup.LastMonth)).toBe('2026-01')
    })

    it('keys Last7Days entries by the LOCAL day', () => {
        // 22:30 local (UTC-3) on March 9 = 01:30 UTC on March 10
        const lateEvening = utcRolledOverDate('2026-03-10T01:30:00Z', { year: 2026, month: 2, day: 9 })
        expect(getDateGroupKey(lateEvening, DateGroup.Last7Days)).toBe('2026-03-09')
    })

    it('keys the remaining groups stably', () => {
        const date = new Date(2025, 11, 10, 12, 0)
        expect(getDateGroupKey(date, DateGroup.Today)).toBe(DateGroup.Today)
        expect(getDateGroupKey(date, DateGroup.Yesterday)).toBe(DateGroup.Yesterday)
        expect(getDateGroupKey(date, DateGroup.OlderYear)).toBe('2025')
    })
})
