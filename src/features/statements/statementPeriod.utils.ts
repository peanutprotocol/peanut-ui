/**
 * Date math for the statement period. The URL and these helpers hold LOCAL
 * calendar days as `yyyy-MM-dd` strings, the same local-day semantics as
 * dateGrouping.utils. The API receives ISO date-times built from the local day
 * bounds (startOfLocalDay / endOfLocalDay).
 */

export type StatementPeriodPreset = 'allTime' | 'last7d' | 'last30d' | 'last3m' | 'last6m' | 'ytd'

/** Select order. Rolling windows (industry-standard preset shape). */
export const STATEMENT_PERIOD_PRESETS: StatementPeriodPreset[] = [
    'allTime',
    'last7d',
    'last30d',
    'last3m',
    'last6m',
    'ytd',
]

/** The select option that opens the calendar. */
export const CUSTOM_PERIOD = 'custom'

export type StatementPeriodOption = StatementPeriodPreset | typeof CUSTOM_PERIOD

/** A calendar pick that can be applied: a first day, and the last one once tapped. */
export type PickedDays = { from: Date; to?: Date }

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
export function presetDates(
    preset: StatementPeriodPreset,
    today: Date = new Date()
): { from: string; to: string } | null {
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

/** The preset a URL period stands for, if any. No bounds is `allTime`; a
 *  hand-picked period matches nothing. */
export function matchPeriodPreset(
    from: string | null,
    to: string | null,
    today: Date = new Date()
): StatementPeriodPreset | undefined {
    if (!from && !to) return 'allTime'
    return STATEMENT_PERIOD_PRESETS.find((preset) => {
        const dates = presetDates(preset, today)
        return dates !== null && dates.from === from && dates.to === to
    })
}

/** Analytics shape for a period. Deliberately the period's NAME and LENGTH,
 *  never the dates: which months a person downloads says when they bank.
 *  `null` days is the unbounded all-time period. */
export function periodAnalytics(period: { preset?: StatementPeriodPreset; from?: string | null; to?: string | null }): {
    range_preset: string
    range_days: number | null
} {
    const preset = period.preset ?? (period.from || period.to ? CUSTOM_PERIOD : 'allTime')
    if (!period.from || !period.to) return { range_preset: preset, range_days: null }
    const days = Math.round(
        (startOfLocalDay(period.to).getTime() - startOfLocalDay(period.from).getTime()) / 86_400_000 + 1
    )
    return { range_preset: preset, range_days: days }
}
