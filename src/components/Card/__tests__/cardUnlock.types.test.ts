import { deriveCardUnlockEntry, isCardUnlockHistoryItem } from '../cardUnlock.types'

describe('deriveCardUnlockEntry', () => {
    const earnedAt = '2025-10-12T00:00:00.000Z'

    it('returns null for an access-only user who never went through the flow (the gabby/dragon bug)', () => {
        // Holds the OG skip badge → hasCardAccess, but never entered the flow
        // (no celebration seen, no card). Pre-fix this surfaced a "You skipped
        // the line" share asset to ~33% of users. wentThroughFlow=false kills it.
        expect(
            deriveCardUnlockEntry({
                wentThroughFlow: false,
                hasCardAccess: true,
                cardAccessGrantedAt: null,
                skipBadges: ['OG_2025_10_12'],
                userBadges: [{ code: 'OG_2025_10_12', earnedAt }],
            })
        ).toBeNull()
    })

    it('returns null for an admin-granted user who never went through the flow', () => {
        expect(
            deriveCardUnlockEntry({
                wentThroughFlow: false,
                hasCardAccess: true,
                cardAccessGrantedAt: '2026-06-01T00:00:00.000Z',
                skipBadges: [],
            })
        ).toBeNull()
    })

    it('returns a badge entry once the user went through the flow (saw celebration or holds a card)', () => {
        const entry = deriveCardUnlockEntry({
            wentThroughFlow: true,
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

    it('returns an admin entry (no badge) when granted + went through the flow', () => {
        const grantedAt = '2026-06-01T00:00:00.000Z'
        const entry = deriveCardUnlockEntry({
            wentThroughFlow: true,
            hasCardAccess: true,
            cardAccessGrantedAt: grantedAt,
            skipBadges: [],
        })
        expect(entry?.via).toBe('admin')
        expect(entry?.timestamp).toBe(grantedAt)
    })

    it('returns null when through the flow but no derivable timestamp', () => {
        // wentThroughFlow but no grant + no skip-badge earnedAt → nothing to
        // anchor the row to; don't fabricate one.
        expect(
            deriveCardUnlockEntry({
                wentThroughFlow: true,
                hasCardAccess: true,
                cardAccessGrantedAt: null,
                skipBadges: [],
            })
        ).toBeNull()
    })
})
