// Pure helpers for the badge-earn toast (TASK-19791).
//
// "Surface it once, while fresh, without interrupting." When a user lands on
// /home with a freshly-earned badge they haven't seen yet, we show a single
// non-blocking toast (tap to inspect) — never a fullscreen takeover, which
// collided with onboarding (a /shhhhh card signup awards BETA_TESTER + SHHHHH
// at once → stacked popups). See BadgeEarnToast.tsx.
//
// Persistence is a per-user localStorage seen-set + a 7-day freshness window —
// same house pattern as the card skip celebration (card/page.tsx). The window
// is what makes that safe: an old badge is never "fresh", so it can't re-toast
// on a new device or on the day this ships. No backend column, no migration.

export type CelebrationBadge = {
    code: string
    name: string
    description: string | null
    earnedAt: string | Date
    isVisible?: boolean
}

// 7 days: generous enough that nearly everyone opens the app within a week of
// earning (covers badges granted by async webhooks), short enough that an old
// badge never re-toasts on a new device.
export const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Badges that should NOT trigger the toast:
//  - WAITLIST_SKIP keeps its bespoke card-flow celebration (BadgeSkipCelebration).
//  - BETA_TESTER is awarded to every signup — too universal to be worth surfacing.
// Other card-access "skip" badges (OG/Devconnect/Arbiverse) are historical, so
// the freshness window already keeps them out.
const EXCLUDED_CODES = new Set<string>(['WAITLIST_SKIP', 'BETA_TESTER'])

const STORAGE_PREFIX = 'badge_earn_toast_seen'

// In-memory fallback for environments where localStorage can't persist
// (Safari/iOS private mode, quota exhausted). Without it, a swallowed write
// meant the seen-set re-hydrated empty every launch and the toast re-fired on
// EVERY /home visit for the whole freshness window. Memory keeps it alive for
// the session (lost on reload — one re-show per session, not an infinite nag).
// Only consulted when the localStorage read misses, so a working localStorage
// stays the source of truth.
const memoryFallback = new Map<string, Set<string>>()

// Per-user key so a shared browser doesn't leak one account's seen-set onto another.
export function celebrationStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}:${userId}`
}

export function loadSeenCodes(userId: string): Set<string> {
    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(celebrationStorageKey(userId))
            if (raw) {
                const parsed: unknown = JSON.parse(raw)
                if (Array.isArray(parsed)) return new Set(parsed.filter((c): c is string => typeof c === 'string'))
            }
        } catch {
            // fall through to the in-memory fallback
        }
    }
    return new Set(memoryFallback.get(userId))
}

export function persistSeenCodes(userId: string, codes: ReadonlySet<string>): void {
    try {
        if (typeof window === 'undefined') throw new Error('no window')
        window.localStorage.setItem(celebrationStorageKey(userId), JSON.stringify([...codes]))
        // localStorage is the source of truth when it works — drop any stale
        // in-memory copy so it can't shadow a later real read.
        memoryFallback.delete(userId)
    } catch {
        // localStorage unavailable (private mode / quota / SSR) — hold the
        // seen-set in memory so the toast doesn't re-nag this session.
        memoryFallback.set(userId, new Set(codes))
    }
}

// Fresh = earned within the last window (future timestamps from clock skew
// count as fresh too; only genuinely-old badges are excluded).
export function isFresh(earnedAt: string | Date, now: number): boolean {
    const earned = new Date(earnedAt).getTime()
    if (!Number.isFinite(earned)) return false
    return earned >= now - FRESHNESS_WINDOW_MS
}

// All visible, fresh, not-yet-seen, non-excluded badges, newest first. Returned
// as a list so the toast can coalesce ("You unlocked 2 badges") instead of
// stacking one toast per badge.
export function pickCelebrationBadges(
    badges: readonly CelebrationBadge[] | undefined,
    seen: ReadonlySet<string>,
    now: number
): CelebrationBadge[] {
    if (!badges?.length) return []
    return badges
        .filter((b) => b.isVisible !== false)
        .filter((b) => !EXCLUDED_CODES.has(b.code))
        .filter((b) => !seen.has(b.code))
        .filter((b) => isFresh(b.earnedAt, now))
        .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
}
