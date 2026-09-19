/**
 * Date math for the activity-history timeframe filter. Values in the URL (and
 * in these helpers) are LOCAL calendar days as `yyyy-MM-dd` strings — same
 * local-day semantics as dateGrouping.utils. The API receives ISO date-times
 * built from the local day bounds (startOfLocalDay / endOfLocalDay).
 */

export type HistoryRangePreset = 'allTime' | 'last7d' | 'last30d' | 'last3m' | 'last6m' | 'ytd'

/** Drawer order. Rolling windows (industry-standard preset shape). */
export const HISTORY_RANGE_PRESETS: HistoryRangePreset[] = ['allTime', 'last7d', 'last30d', 'last3m', 'last6m', 'ytd']

export const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function toLocalDateString(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
}

/** Local midnight for a `yyyy-MM-dd` string. */
export function startOfLocalDay(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/** Last millisecond of the local day for a `yyyy-MM-dd` string. */
export function endOfLocalDay(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/** Same local day `n` months back, clamped to the target month's last day
 *  (May 31 − 3 months = Feb 28/29, never a rolled-over Mar 3). */
function monthsBack(today: Date, months: number): Date {
    const target = new Date(today.getFullYear(), today.getMonth() - months, 1)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    target.setDate(Math.min(today.getDate(), lastDay))
    return target
}

function daysBack(today: Date, days: number): Date {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
}

/** The preset's local-day bounds, or null for the unbounded `allTime`. */
export function presetDates(preset: HistoryRangePreset, today: Date = new Date()): { from: string; to: string } | null {
    const to = toLocalDateString(today)
    switch (preset) {
        case 'allTime':
            return null
        case 'last7d':
            return { from: toLocalDateString(daysBack(today, 6)), to }
        case 'last30d':
            return { from: toLocalDateString(daysBack(today, 29)), to }
        case 'last3m':
            return { from: toLocalDateString(monthsBack(today, 3)), to }
        case 'last6m':
            return { from: toLocalDateString(monthsBack(today, 6)), to }
        case 'ytd':
            return { from: toLocalDateString(new Date(today.getFullYear(), 0, 1)), to }
    }
}

/** Analytics shape for a range. Deliberately the window's NAME and LENGTH, never
 *  the dates: which months a person exports says when they bank. `null` days is
 *  the unbounded all-time window. */
export function rangeAnalytics(range: {
    activePreset?: HistoryRangePreset
    from?: string | null
    to?: string | null
}): { range_preset: string; range_days: number | null } {
    const preset = range.activePreset ?? (range.from || range.to ? 'custom' : 'allTime')
    if (!range.from || !range.to) return { range_preset: preset, range_days: null }
    const days = Math.round(
        (startOfLocalDay(range.to).getTime() - startOfLocalDay(range.from).getTime()) / 86_400_000 + 1
    )
    return { range_preset: preset, range_days: days }
}
