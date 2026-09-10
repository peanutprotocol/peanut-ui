/**
 * @fileoverview pure list logic for the home Activity widget, extracted from
 * HomeHistory so the merge → sort → slice pipeline is unit-testable.
 */

/** Rows shown in the home Activity widget. */
export const RECENT_ACTIVITY_LIMIT = 5

/**
 * Fetch headroom over RECENT_ACTIVITY_LIMIT: synthetic rows (badges, KYC,
 * card-unlock) and live websocket entries merge into the fetched list before
 * the final slice, so fetching exactly RECENT_ACTIVITY_LIMIT rows let older
 * synthetic rows evict real recent transactions. This is a UNIQUE-row target,
 * not a page size — latest mode follows the API cursor until it's met (see
 * collectLatestEntries), since pot contributions collapse into one rollup
 * row after the API applies its limit.
 */
export const RECENT_ACTIVITY_FETCH_LIMIT = 10

/** Replaces the entry with the same uuid in place, or appends it. */
export function upsertEntryByUuid<T extends { uuid: string }>(entries: T[], entry: T): void {
    const existingIndex = entries.findIndex((e) => e.uuid === entry.uuid)
    if (existingIndex !== -1) {
        entries[existingIndex] = entry
    } else {
        entries.push(entry)
    }
}

/**
 * Sorts entries newest-first and keeps the top `limit`, so the freshest
 * items always win regardless of the merge order of fetched, websocket,
 * and synthetic rows.
 */
export function selectRecentEntries<T extends { timestamp: Date | string }>(
    entries: T[],
    limit: number = RECENT_ACTIVITY_LIMIT
): T[] {
    return [...entries]
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
        .slice(0, limit)
}
