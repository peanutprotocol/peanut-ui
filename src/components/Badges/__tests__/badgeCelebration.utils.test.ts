import {
    FRESHNESS_WINDOW_MS,
    celebrationStorageKey,
    isFresh,
    loadSeenCodes,
    persistSeenCodes,
    pickCelebrationBadges,
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

    describe('pickCelebrationBadges', () => {
        it('returns [] for empty/undefined input', () => {
            expect(pickCelebrationBadges(undefined, new Set(), NOW)).toEqual([])
            expect(pickCelebrationBadges([], new Set(), NOW)).toEqual([])
        })
        it('returns all fresh, unseen, visible badges newest-first', () => {
            const badges = [badge({ code: 'OLDER', earnedAt: iso(1000) }), badge({ code: 'NEWER', earnedAt: iso(100) })]
            expect(pickCelebrationBadges(badges, new Set(), NOW).map((b) => b.code)).toEqual(['NEWER', 'OLDER'])
        })
        it('excludes WAITLIST_SKIP (it has its own card-flow celebration)', () => {
            const badges = [
                badge({ code: 'WAITLIST_SKIP', earnedAt: iso(0) }),
                badge({ code: 'SHHHHH', earnedAt: iso(0) }),
            ]
            expect(pickCelebrationBadges(badges, new Set(), NOW).map((b) => b.code)).toEqual(['SHHHHH'])
        })
        it('excludes already-seen, stale, and invisible badges', () => {
            const badges = [
                badge({ code: 'SEEN', earnedAt: iso(0) }),
                badge({ code: 'STALE', earnedAt: iso(FRESHNESS_WINDOW_MS + 1) }),
                badge({ code: 'HIDDEN', earnedAt: iso(0), isVisible: false }),
                badge({ code: 'GOOD', earnedAt: iso(0) }),
            ]
            expect(pickCelebrationBadges(badges, new Set(['SEEN']), NOW).map((b) => b.code)).toEqual(['GOOD'])
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
