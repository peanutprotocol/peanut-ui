// Pure helpers for the fullscreen badge-receipt celebration (TASK-19791).
//
// "Celebrate once, while fresh." A badge fires the fullscreen celebration on
// the next /users/me refetch iff it was earned within FRESHNESS_WINDOW_MS and
// hasn't been celebrated yet on this device (a per-user localStorage seen-set).
//
// Why localStorage + a freshness window instead of a backend `celebratedAt`:
// it mirrors the existing one-time-celebration gate (card/page.tsx's
// `card_skip_celebration_seen_v2`, per-device by design). The window is what
// makes that safe — a badge earned long ago is never "fresh", so it never
// retro-fires on a new device or on the day the feature ships. That removes
// the need for a DB column, a mark-celebrated endpoint, and a deploy-day
// backfill. Trade-off: a badge earned in the last week can re-celebrate on a
// second device within that week — recent + positive, not spam.

export type CelebrationBadge = {
    code: string
    name: string
    description: string | null
    earnedAt: string | Date
    isVisible?: boolean
}

// 7 days: generous enough that nearly everyone opens the app within a week of
// earning (covers badges granted by async webhooks, e.g. KYC/event claims),
// short enough that an old badge never re-celebrates on a new device.
export const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// WAITLIST_SKIP keeps its bespoke card-flow celebration (BadgeSkipCelebration),
// so it's excluded here to avoid a double-celebration. Other card-access
// "skip" badges (OG/Devconnect/Arbiverse, …) are server-driven and historical
// — the freshness window already keeps them from double-firing. The only
// residual overlap is a card-access badge minted within the last 7 days; that
// edge is left for QA to rule on (extend this set if it ever annoys).
const EXCLUDED_CODES = new Set<string>(['WAITLIST_SKIP'])

const STORAGE_PREFIX = 'badge_celebration_seen'

// Per-user key so a shared browser doesn't leak one account's seen-set onto
// another (the skip-celebration precedent is global; this is one better).
export function celebrationStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}:${userId}`
}

export function loadSeenCodes(userId: string): Set<string> {
    if (typeof window === 'undefined') return new Set()
    try {
        const raw = window.localStorage.getItem(celebrationStorageKey(userId))
        if (!raw) return new Set()
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return new Set()
        return new Set(parsed.filter((c): c is string => typeof c === 'string'))
    } catch {
        return new Set()
    }
}

export function persistSeenCodes(userId: string, codes: ReadonlySet<string>): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(celebrationStorageKey(userId), JSON.stringify([...codes]))
    } catch {
        // localStorage can throw (private mode / quota). A missed write just
        // means the celebration may re-show — never block the UI on it.
    }
}

// Fresh = earned within the last window (future timestamps from clock skew
// count as fresh too; only genuinely-old badges are excluded).
export function isFresh(earnedAt: string | Date, now: number): boolean {
    const earned = new Date(earnedAt).getTime()
    if (!Number.isFinite(earned)) return false
    return earned >= now - FRESHNESS_WINDOW_MS
}

// The newest visible, fresh, not-yet-celebrated badge to celebrate (or null).
// Returns one at a time; the next surfaces on the following render once this
// one is marked seen — a natural queue with no extra state.
export function pickCelebrationBadge(
    badges: readonly CelebrationBadge[] | undefined,
    seen: ReadonlySet<string>,
    now: number
): CelebrationBadge | null {
    if (!badges?.length) return null
    return (
        badges
            .filter((b) => b.isVisible !== false)
            .filter((b) => !EXCLUDED_CODES.has(b.code))
            .filter((b) => !seen.has(b.code))
            .filter((b) => isFresh(b.earnedAt, now))
            .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())[0] ?? null
    )
}
