/**
 * PEANUT_TEAM is a permission record, not a collectible. The public profile
 * response already omits it (that query filters on isVisible), but /users/me
 * returns it so the beta switch can read its own permission — which means
 * every surface rendering the CALLER's own badges has to filter it out, or a
 * customer who tapped five times sees "Peanut Team" on their own profile.
 */
import { displayableBadges, PEANUT_TEAM_BADGE } from '../badges.consts'

it('drops the permission record', () => {
    expect(displayableBadges([{ code: PEANUT_TEAM_BADGE }])).toEqual([])
})

// The server's own answer, so a future record badge needs no client change.
it('drops anything the server marked invisible, whatever its code', () => {
    expect(displayableBadges([{ code: 'SOME_FUTURE_RECORD', isVisible: false }])).toEqual([])
})

// Rows awarded before the server started marking them invisible.
it('still drops a legacy record row that came back visible', () => {
    expect(displayableBadges([{ code: PEANUT_TEAM_BADGE, isVisible: true }])).toEqual([])
})

it('keeps a badge with no isVisible field, which is how most of them arrive', () => {
    expect(displayableBadges([{ code: 'ENS' }])).toEqual([{ code: 'ENS' }])
})

it('keeps every real collectible, including the other insider badges', () => {
    const badges = [{ code: 'BETA_TESTER' }, { code: PEANUT_TEAM_BADGE }, { code: 'CARD_PIONEER' }]

    expect(displayableBadges(badges)).toEqual([{ code: 'BETA_TESTER' }, { code: 'CARD_PIONEER' }])
})

it('preserves the caller order and the full badge shape', () => {
    const badges = [
        { code: 'OG_2025_10_12', earnedAt: '2026-01-01', name: 'OG' },
        { code: PEANUT_TEAM_BADGE, earnedAt: '2026-02-01', name: 'Peanut Team' },
        { code: 'ENS', earnedAt: '2026-03-01', name: 'ENS' },
    ]

    expect(displayableBadges(badges).map((b) => b.name)).toEqual(['OG', 'ENS'])
})

it('does not mutate the list it is given', () => {
    const badges = [{ code: PEANUT_TEAM_BADGE }, { code: 'ENS' }]

    displayableBadges(badges)

    expect(badges).toHaveLength(2)
})
