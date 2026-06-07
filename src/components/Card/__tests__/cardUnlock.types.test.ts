import { deriveCardUnlockEntry, isCardUnlockHistoryItem } from '../cardUnlock.types'

describe('deriveCardUnlockEntry', () => {
    const earnedAt = '2025-10-12T00:00:00.000Z'

    it('returns null for an access-only user with NO issued card (the gabby/dragon bug)', () => {
        // Holds the OG skip badge → hasCardAccess, but never got a card.
        // Pre-fix this surfaced a "You skipped the line" share asset to
        // ~33% of users. Gating on hasIssuedCard kills it.
        expect(
            deriveCardUnlockEntry({
                hasIssuedCard: false,
                hasCardAccess: true,
                cardAccessGrantedAt: null,
                skipBadges: ['OG_2025_10_12'],
                userBadges: [{ code: 'OG_2025_10_12', earnedAt }],
            })
        ).toBeNull()
    })

    it('returns null for an admin-granted user with no issued card', () => {
        expect(
            deriveCardUnlockEntry({
                hasIssuedCard: false,
                hasCardAccess: true,
                cardAccessGrantedAt: '2026-06-01T00:00:00.000Z',
                skipBadges: [],
            })
        ).toBeNull()
    })

    it('returns a badge entry once the user actually has a card', () => {
        const entry = deriveCardUnlockEntry({
            hasIssuedCard: true,
            hasCardAccess: true,
            cardAccessGrantedAt: null,
            skipBadges: ['OG_2025_10_12'],
            userBadges: [{ code: 'OG_2025_10_12', earnedAt }],
        })
        expect(entry).not.toBeNull()
        expect(entry?.via).toBe('badge')
        expect(entry?.badgeCode).toBe('OG_2025_10_12')
        expect(entry?.timestamp).toBe(earnedAt)
        expect(isCardUnlockHistoryItem(entry)).toBe(true)
    })

    it('retires the row once the celebration has been seen (the always-there bug)', () => {
        // Same inputs as the badge-entry case above (which returns a row), but
        // with celebrationSeenAt set → null. Pre-fix the row was derived from
        // permanent inputs + force-kept, so it never left the feed.
        expect(
            deriveCardUnlockEntry({
                hasIssuedCard: true,
                hasCardAccess: true,
                cardAccessGrantedAt: null,
                skipBadges: ['OG_2025_10_12'],
                userBadges: [{ code: 'OG_2025_10_12', earnedAt }],
                celebrationSeenAt: '2026-06-06T00:00:00.000Z',
            })
        ).toBeNull()
    })

    it('returns an admin entry (no badge) when granted + card issued', () => {
        const grantedAt = '2026-06-01T00:00:00.000Z'
        const entry = deriveCardUnlockEntry({
            hasIssuedCard: true,
            hasCardAccess: true,
            cardAccessGrantedAt: grantedAt,
            skipBadges: [],
        })
        expect(entry?.via).toBe('admin')
        expect(entry?.timestamp).toBe(grantedAt)
    })

    it('returns null when a card exists but no derivable timestamp', () => {
        // hasIssuedCard but no grant + no skip-badge earnedAt → nothing to
        // anchor the row to; don't fabricate one.
        expect(
            deriveCardUnlockEntry({
                hasIssuedCard: true,
                hasCardAccess: true,
                cardAccessGrantedAt: null,
                skipBadges: [],
            })
        ).toBeNull()
    })
})
