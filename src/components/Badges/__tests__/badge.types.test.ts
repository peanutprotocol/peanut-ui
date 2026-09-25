import type { BadgeCatalogEntry } from '@/services/badges'
import { buildBadgeCollection, type OwnedBadge } from '../badge.types'

const catalog = [
    {
        code: 'FIRST_INVITE',
        name: 'First Invite',
        description: 'Invite one friend.',
        publicDescription: 'Invited one friend.',
        iconUrl: '/badges/first_invite.svg',
        unlock: { kind: 'invites', target: 1 },
        earnable: true,
    },
    {
        code: 'CARD_FIRST_SWIPE',
        name: 'First Swipe',
        description: 'Use your card.',
        publicDescription: 'Used their card.',
        iconUrl: '/badges/happy_card.svg',
        unlock: { kind: 'card_purchase' },
        earnable: true,
    },
    {
        code: 'PSYOPS_DIVISION',
        name: 'Psyops Division',
        description: 'Enlisted in the Psyops Division.',
        publicDescription: 'Enlisted in the Psyops Division.',
        iconUrl: '/badges/psyops_division.svg',
        unlock: { kind: 'campaign' },
        earnable: false,
    },
] satisfies BadgeCatalogEntry[]

const owned = (code: string, earnedAt: string, overrides: Partial<OwnedBadge> = {}): OwnedBadge => ({
    code,
    name: code,
    description: null,
    iconUrl: null,
    color: null,
    earnedAt,
    ...overrides,
})

describe('buildBadgeCollection', () => {
    it('puts newest earned badges first, then locked catalog badges', () => {
        const badges = buildBadgeCollection(
            [owned('FIRST_INVITE', '2026-09-01T00:00:00Z'), owned('RETIRED_BADGE', '2026-09-10T00:00:00Z')],
            catalog
        )

        expect(badges.map(({ code, earned }) => [code, earned])).toEqual([
            ['RETIRED_BADGE', true],
            ['FIRST_INVITE', true],
            ['CARD_FIRST_SWIPE', false],
        ])
        expect(badges[1]).toMatchObject({ name: 'FIRST_INVITE', description: 'Invite one friend.' })
    })

    it('never shows a badge nobody can earn as locked, but keeps it for its holder', () => {
        const browsing = buildBadgeCollection([], catalog)
        expect(browsing.map(({ code }) => code)).not.toContain('PSYOPS_DIVISION')

        const holding = buildBadgeCollection([owned('PSYOPS_DIVISION', '2026-07-02T00:00:00Z')], catalog)
        expect(holding.find(({ code }) => code === 'PSYOPS_DIVISION')).toMatchObject({
            earned: true,
            description: 'Enlisted in the Psyops Division.',
        })
    })

    it('does not duplicate an earned badge from the catalog', () => {
        const badges = buildBadgeCollection([owned('FIRST_INVITE', '2026-09-01T00:00:00Z')], catalog)
        expect(badges.filter(({ code }) => code === 'FIRST_INVITE')).toHaveLength(1)
    })
})
