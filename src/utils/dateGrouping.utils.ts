/**
 * @fileoverview utility functions for grouping and formatting dates for transaction history.
 */

/**
 * represents the possible grouping categories for history entries.
 */
export enum DateGroup {
    Today = 'today',
    Yesterday = 'yesterday',
    Last7Days = 'last7days',
    LastMonth = 'lastmonth', // previous calendar month (crosses the year boundary in january)
    Older = 'older', // older means different month but same year
    OlderYear = 'olderyear', // different year
}

/**
 * checks if two dates are on the same day, ignoring time.
 * @param date1 first date.
 * @param date2 second date.
 * @returns true if they are the same day, false otherwise.
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

/**
 * calculates the signed difference in local calendar days between two dates.
 * @param date1 first date.
 * @param date2 second date.
 * @returns how many days date1 is ahead of date2 (negative when date1 is earlier).
 */
function daysDifference(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000 // hours*minutes*seconds*milliseconds
    // reset time to midnight for accurate day difference
    const date1Midnight = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
    const date2Midnight = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
    return Math.round((date1Midnight.getTime() - date2Midnight.getTime()) / oneDay)
}

/**
 * classifies a date into a specific group relative to today.
 * all comparisons use the viewer's LOCAL calendar day, so a late-evening
 * timestamp never jumps to the next day's bucket via UTC.
 * @param date the date to classify.
 * @param today the current date (passed for consistency, defaults to new date()).
 * @returns the date group category.
 */
export function getDateGroup(date: Date, today: Date = new Date()): DateGroup {
    // days the entry lies in the past; negative = future-dated (clock skew,
    // server-stamped entries slightly ahead) — bucket those with Today.
    const daysDiff = daysDifference(today, date)

    if (daysDiff <= 0 || isSameDay(date, today)) {
        return DateGroup.Today
    }
    if (daysDiff === 1) {
        return DateGroup.Yesterday
    }
    if (daysDiff <= 7) {
        return DateGroup.Last7Days
    }
    // check if it's in the previous calendar month (december of the previous
    // year when today is january)
    const prevMonth = (today.getMonth() + 11) % 12
    const prevMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
    if (date.getFullYear() === prevMonthYear && date.getMonth() === prevMonth) {
        return DateGroup.LastMonth
    }
    // check if it's in the same year but different month (and not last month)
    if (date.getFullYear() === today.getFullYear()) {
        return DateGroup.Older
    }
    // otherwise, it's in a different year
    return DateGroup.OlderYear
}

/**
 * generates a unique key for a date group to detect changes.
 * keys are derived from LOCAL date parts (never toISOString) so they agree
 * with getDateGroup's local-day classification.
 * @param date the date.
 * @param group the date group category.
 * @returns a string key representing the group.
 */
export function getDateGroupKey(date: Date, group: DateGroup): string {
    const localYearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
    switch (group) {
        case DateGroup.Today:
        case DateGroup.Yesterday:
            return group // these are unique enough
        case DateGroup.Last7Days:
            // key by day within last 7 days
            return `${localYearMonth}-${date.getDate().toString().padStart(2, '0')}` // yyyy-mm-dd
        case DateGroup.LastMonth:
        case DateGroup.Older:
            // key by month and year
            return localYearMonth // yyyy-mm
        case DateGroup.OlderYear:
            // key by year
            return date.getFullYear().toString()
        default:
            return `${localYearMonth}-${date.getDate().toString().padStart(2, '0')}`
    }
}
