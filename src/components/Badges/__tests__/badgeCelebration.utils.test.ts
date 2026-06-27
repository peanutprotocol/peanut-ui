import {
    FRESHNESS_WINDOW_MS,
    celebrationStorageKey,
    isFresh,
    loadSeenCodes,
    persistSeenCodes,
    pickCelebrationBadge,
    type CelebrationBadge,
} from '@/components/Badges/badgeCelebration.utils'

const NOW = 1_700_000_000_000 // fixed reference time
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

function badge(over: Partial<CelebrationBadge> & { code: string; earnedAt: string | Date }): CelebrationBadge {
    return { name: over.code, description: null, ...over }
}

describe('badgeCelebration.utils', () => {
    describe('isFresh', () => {
        it('true for a badge earned just now', () => {
            expect(isFresh(iso(0), NOW)).toBe(true)
        })
        it('true just inside the window', () => {
            expect(isFresh(iso(FRESHNESS_WINDOW_MS - 1000), NOW)).toBe(true)
        })
        it('false just past the window', () => {
            expect(isFresh(iso(FRESHNESS_WINDOW_MS + 1000), NOW)).toBe(false)
        })
        it('true for a future timestamp (clock skew)', () => {
            expect(isFresh(new Date(NOW + 60_000).toISOString(), NOW)).toBe(true)
        })
        it('false for an invalid date', () => {
            expect(isFresh('not-a-date', NOW)).toBe(false)
        })
    })

    describe('pickCelebrationBadge', () => {
        it('returns null for empty/undefined input', () => {
            expect(pickCelebrationBadge(undefined, new Set(), NOW)).toBeNull()
            expect(pickCelebrationBadge([], new Set(), NOW)).toBeNull()
        })
        it('picks the newest fresh, unseen, visible badge', () => {
            const badges = [badge({ code: 'OLDER', earnedAt: iso(1000) }), badge({ code: 'NEWER', earnedAt: iso(100) })]
            expect(pickCelebrationBadge(badges, new Set(), NOW)?.code).toBe('NEWER')
        })
        it('skips WAITLIST_SKIP (it has its own card-flow celebration)', () => {
            const badges = [badge({ code: 'WAITLIST_SKIP', earnedAt: iso(0) })]
            expect(pickCelebrationBadge(badges, new Set(), NOW)).toBeNull()
        })
        it('skips already-seen codes', () => {
            const badges = [badge({ code: 'OG_2025_10_12', earnedAt: iso(0) })]
            expect(pickCelebrationBadge(badges, new Set(['OG_2025_10_12']), NOW)).toBeNull()
        })
        it('skips stale badges (outside the window)', () => {
            const badges = [badge({ code: 'OG_2025_10_12', earnedAt: iso(FRESHNESS_WINDOW_MS + 1) })]
            expect(pickCelebrationBadge(badges, new Set(), NOW)).toBeNull()
        })
        it('skips invisible badges', () => {
            const badges = [badge({ code: 'HIDDEN', earnedAt: iso(0), isVisible: false })]
            expect(pickCelebrationBadge(badges, new Set(), NOW)).toBeNull()
        })
        it('falls through to an older fresh badge when the newest is already seen', () => {
            const badges = [badge({ code: 'NEWER', earnedAt: iso(100) }), badge({ code: 'OLDER', earnedAt: iso(1000) })]
            expect(pickCelebrationBadge(badges, new Set(['NEWER']), NOW)?.code).toBe('OLDER')
        })
    })

    describe('seen-set persistence (per user)', () => {
        beforeEach(() => window.localStorage.clear())

        it('round-trips codes under a per-user key', () => {
            persistSeenCodes('user-a', new Set(['OG_2025_10_12', 'BETA_TESTER']))
            expect(window.localStorage.getItem(celebrationStorageKey('user-a'))).toContain('OG_2025_10_12')
            expect(loadSeenCodes('user-a')).toEqual(new Set(['OG_2025_10_12', 'BETA_TESTER']))
        })
        it('isolates users on the same device', () => {
            persistSeenCodes('user-a', new Set(['OG_2025_10_12']))
            expect(loadSeenCodes('user-b')).toEqual(new Set())
        })
        it('returns an empty set on corrupt JSON', () => {
            window.localStorage.setItem(celebrationStorageKey('user-a'), '{not json')
            expect(loadSeenCodes('user-a')).toEqual(new Set())
        })
    })
})
