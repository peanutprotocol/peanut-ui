/**
 * Synthetic "card unlocked" history entry — mirrors the KYC + Badge
 * synthetic-entry pattern. Surfaces in the user's activity feed so they
 * can re-open the share asset they earned on the celebration moment.
 *
 * No DB table needed — derived client-side from the user's
 * cardAccessGrantedAt timestamp + the skip-badge they hold.
 */

export type CardUnlockVia = 'badge' | 'admin' | 'public-launch'

export interface CardUnlockHistoryEntry {
    isCardUnlock: true
    /** Stable id, lets list keys stay consistent across re-renders. */
    uuid: string
    /** ISO timestamp — sorted into the activity feed by this. */
    timestamp: string
    /** How the user got in. Drives the row copy + (later) the celebration replay. */
    via: CardUnlockVia
    /** Populated when via=badge — the skip-badge code that did it. */
    badgeCode?: string
}

export const isCardUnlockHistoryItem = (entry: unknown): entry is CardUnlockHistoryEntry => {
    return (
        typeof entry === 'object' &&
        entry !== null &&
        'isCardUnlock' in entry &&
        (entry as { isCardUnlock?: unknown }).isCardUnlock === true
    )
}

/** Returns null if the user has no card-access timestamp yet (still on the
 *  waitlist) — the row should only render once they're released. */
export function deriveCardUnlockEntry(args: {
    cardAccessGrantedAt: string | null | undefined
    skipBadges: string[]
}): CardUnlockHistoryEntry | null {
    if (!args.cardAccessGrantedAt) return null
    const badgeCode = args.skipBadges[0]
    const via: CardUnlockVia = badgeCode ? 'badge' : 'admin'
    return {
        isCardUnlock: true,
        uuid: 'card-unlock',
        timestamp: args.cardAccessGrantedAt,
        via,
        badgeCode,
    }
}
