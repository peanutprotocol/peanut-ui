import type { DateRange } from 'react-day-picker'

/** Local-midnight Date for react-day-picker's `data-day` value (`yyyy-MM-dd`). */
export function parseDayAttribute(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** The inclusive range between two days, in calendar order whichever came first. */
export function rangeBetween(a: Date, b: Date): DateRange {
    return a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a }
}

export interface SelectableDay {
    iso: string
    day: Date
}

/**
 * The day a calendar cell stands for, or null when the cell cannot be picked:
 * disabled (future), hidden, or an adjacent month's outside day.
 */
export function selectableDay(cell: HTMLElement | null | undefined): SelectableDay | null {
    if (!cell) return null
    const { day: iso, disabled, hidden, outside } = cell.dataset
    if (!iso || disabled === 'true' || hidden === 'true' || outside === 'true') return null
    const day = parseDayAttribute(iso)
    return day ? { iso, day } : null
}

/**
 * The selectable day under a viewport point. Hit-testing by coordinates, not by
 * event target, because a touch pointer stays captured by the cell it started
 * on — its move events never retarget to the cell under the finger.
 */
export function selectableDayAt(x: number, y: number): SelectableDay | null {
    const element = typeof document === 'undefined' ? null : document.elementFromPoint(x, y)
    return selectableDay(element?.closest<HTMLElement>('[data-day]'))
}
