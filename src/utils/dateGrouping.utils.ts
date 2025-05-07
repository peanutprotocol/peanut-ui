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
    LastMonth = 'lastmonth',
    Older = 'older', // older means different month but same year
    OlderYear = 'olderyear', // different year
}

/**
 * options for date formatting (e.g., March 30, 2025).
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
}

const MONTH_YEAR_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'long',
    year: 'numeric',
}

const YEAR_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    year: 'numeric',
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
 * calculates the difference in days between two dates.
 * @param date1 first date.
 * @param date2 second date.
 * @returns the number of days between the two dates.
 */
function daysDifference(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000 // hours*minutes*seconds*milliseconds
    // reset time to midnight for accurate day difference
    const date1Midnight = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
    const date2Midnight = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
    return Math.round(Math.abs((date1Midnight.getTime() - date2Midnight.getTime()) / oneDay))
}

/**
 * classifies a date into a specific group relative to today.
 * @param date the date to classify.
 * @param today the current date (passed for consistency, defaults to new date()).
 * @returns the date group category.
 */
export function getDateGroup(date: Date, today: Date = new Date()): DateGroup {
    const daysDiff = daysDifference(today, date)

    if (isSameDay(date, today)) {
        return DateGroup.Today
    }
    if (daysDiff === 1) {
        return DateGroup.Yesterday
    }
    if (daysDiff <= 7) {
        return DateGroup.Last7Days
    }
    // check if it's in the previous month but same year
    if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() - 1) {
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
 * formats a date into a string suitable for a group header.
 * @param date the date to format.
 * @param group the date group category it belongs to.
 * @param today the current date (optional).
 * @returns a formatted date string for the header.
 */
export function formatGroupHeaderDate(date: Date, group: DateGroup, today: Date = new Date()): string {
    switch (group) {
        case DateGroup.Today:
            return 'today'
        case DateGroup.Yesterday:
            return 'yesterday'
        case DateGroup.Last7Days:
        case DateGroup.LastMonth:
        case DateGroup.Older:
            // show full date (month day, year) for all other past dates within the same or previous years
            return date.toLocaleDateString('en-us', DATE_FORMAT_OPTIONS)
        case DateGroup.OlderYear:
            // can still optionally show only year for very old entries, or use full date too
            return date.toLocaleDateString('en-us', DATE_FORMAT_OPTIONS) // using full date for consistency now
        default:
            // fallback to full date format
            return date.toLocaleDateString('en-us', DATE_FORMAT_OPTIONS)
    }
}

/**
 * generates a unique key for a date group to detect changes.
 * @param date the date.
 * @param group the date group category.
 * @returns a string key representing the group.
 */
export function getDateGroupKey(date: Date, group: DateGroup): string {
    switch (group) {
        case DateGroup.Today:
        case DateGroup.Yesterday:
            return group // these are unique enough
        case DateGroup.Last7Days:
            // key by day within last 7 days
            return date.toISOString().slice(0, 10) // yyyy-mm-dd
        case DateGroup.LastMonth:
        case DateGroup.Older:
            // key by month and year
            return date.toISOString().slice(0, 7) // yyyy-mm
        case DateGroup.OlderYear:
            // key by year
            return date.getFullYear().toString()
        default:
            return date.toISOString() // full iso string as fallback
    }
}
