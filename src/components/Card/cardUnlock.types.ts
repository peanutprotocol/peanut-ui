/**
 * Synthetic "card unlocked" history entry — mirrors the KYC + Badge
 * synthetic-entry pattern. Surfaces in the user's activity feed so they
 * can re-open the share asset they earned on the celebration moment.
 *
 * No DB table needed — derived client-side. Only surfaces once the user
 * has an issued card (see deriveCardUnlockEntry); the timestamp comes from
 * their cardAccessGrantedAt or earliest skip-badge earnedAt. It is a
 * normal chronological row: NOT pinned in the home top-5 (it ages out
 * behind newer activity) and always reachable on the paginated /history
 * page (Hugo 2026-06-10).
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

/** Returns null unless the user has ACTUALLY been issued a card. Card
 *  *access* (a skip badge or an admin grant) is NOT enough — it only means
 *  the user is allowed a card, not that they ever entered the flow or got
 *  one. Gating on access alone surfaced this share-asset row + "I got my
 *  Peanut card" image to ~33% of users (every OG / Devconnect / Arbiverse /
 *  Pioneer badge holder), the vast majority of whom never received a card.
 *
 *  Once gated on `hasIssuedCard`, picks the best available timestamp:
 *    1. Explicit `cardAccessGrantedAt` (admin grant / waitlist release).
 *    2. Earliest skip-badge `earnedAt` (badge-driven access — user has
 *       been "in" since they earned the badge, even if the BE never
 *       stamped a separate grant timestamp).
 *  If neither is present, returns null rather than fabricating one. */
export function deriveCardUnlockEntry(args: {
    /** True once the user has at least one Rain card row (the only
     *  server-verifiable signal that they got through the card flow). */
    hasIssuedCard: boolean
    hasCardAccess: boolean
    cardAccessGrantedAt: string | null | undefined
    skipBadges: string[]
    userBadges?: Array<{ code: string; earnedAt?: string | Date | null }>
}): CardUnlockHistoryEntry | null {
    if (!args.hasIssuedCard) return null
    if (!args.hasCardAccess) return null

    let timestamp = args.cardAccessGrantedAt ?? undefined
    if (!timestamp && args.userBadges && args.skipBadges.length > 0) {
        const skipSet = new Set(args.skipBadges)
        const earned = args.userBadges
            .filter((b) => skipSet.has(b.code) && b.earnedAt)
            .map((b) => new Date(b.earnedAt as string | Date).getTime())
            .filter((t) => Number.isFinite(t))
            .sort((a, b) => a - b)
        if (earned.length > 0) timestamp = new Date(earned[0]).toISOString()
    }
    if (!timestamp) return null

    const badgeCode = args.skipBadges[0]
    const via: CardUnlockVia = badgeCode ? 'badge' : 'admin'
    return {
        isCardUnlock: true,
        uuid: 'card-unlock',
        timestamp,
        via,
        badgeCode,
    }
}
