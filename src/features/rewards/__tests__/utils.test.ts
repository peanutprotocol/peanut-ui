import { getTierBadge, getTierProgressPercent, inviteeDisplayName } from '../utils'

describe('getTierProgressPercent', () => {
    it('is maxed at tier 2 and above', () => {
        expect(getTierProgressPercent(2, 0, 1000)).toBe(100)
        expect(getTierProgressPercent(3, 50, 1000)).toBe(100)
    })

    it('eases the ratio to the next threshold with pow 0.6', () => {
        expect(getTierProgressPercent(0, 500, 1000)).toBeCloseTo(Math.pow(0.5, 0.6) * 100)
    })

    it('caps at 100 when points exceed the threshold', () => {
        expect(getTierProgressPercent(1, 2000, 1000)).toBe(100)
    })

    it('is 0 when the threshold is missing or zero', () => {
        expect(getTierProgressPercent(0, 500, 0)).toBe(0)
    })
})

describe('getTierBadge', () => {
    it('falls back to tier 0 for out-of-range tiers', () => {
        expect(getTierBadge(99)).toBe(getTierBadge(0))
        expect(getTierBadge(-1)).toBe(getTierBadge(0))
    })
})

// TASK-24090: the API sends the name to show in fullName (the username when the
// invitee hid their name), so the screens no longer wait for a showFullName flag.
describe('inviteeDisplayName', () => {
    it('shows the full name the API sends', () => {
        expect(inviteeDisplayName({ fullName: 'Ana Lopez', username: 'ana' })).toBe('Ana Lopez')
    })

    it('falls back to the username when there is no full name', () => {
        expect(inviteeDisplayName({ fullName: null, username: 'ana' })).toBe('ana')
    })

    it('is null for an invitee who never finished signup', () => {
        expect(inviteeDisplayName({ fullName: null, username: null })).toBeNull()
    })
})
