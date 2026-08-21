import { buildUnlockGroups, type BuildUnlockGroupsInput } from '@/utils/unlock-payments.utils'

const base = (over?: Partial<BuildUnlockGroupsInput>): BuildUnlockGroupsInput => ({
    regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'unlock' },
    qrOnly: { brazil: false, argentina: false },
    restrictions: { banking: false, card: false },
    card: 'get',
    residenceIso2: null,
    isEuropeResidence: false,
    ...over,
})

const group = (groups: ReturnType<typeof buildUnlockGroups>, id: string) => {
    const found = groups.find((g) => g.id === id)
    if (!found) throw new Error(`missing group ${id}`)
    return found
}

describe('buildUnlockGroups', () => {
    it('leads with Everywhere: always-on P2P, then the card', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[0].id).toBe('everywhere')
        expect(groups[0].rows.map((r) => [r.id, r.chip])).toEqual([
            ['p2p', 'alwaysOn'],
            ['card', 'unlock'],
        ])
    })

    it('floats the residence group to the top of the regions', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'BR' }))
        expect(groups[1].id).toBe('brazil')
        expect(groups[1].isYourRegion).toBe(true)
        // stable sort contract: everything else keeps catalog order
        expect(groups.map((g) => g.id)).toEqual([
            'everywhere',
            'brazil',
            'argentina',
            'unitedStates',
            'mexico',
            'europe',
        ])
    })

    it('marks Europe as your region for a European residence', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'DE', isEuropeResidence: true }))
        expect(groups[1].id).toBe('europe')
    })

    it('an active latam merges PIX and bank into one Brazil row', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'active' } })
        )
        expect(group(groups, 'brazil').rows).toEqual([expect.objectContaining({ id: 'pix-bank', chip: 'active' })])
    })

    it('a QR-only Brazil splits the merged row: QR active, bank still an offer', () => {
        const groups = buildUnlockGroups(base({ qrOnly: { brazil: true, argentina: false } }))
        expect(group(groups, 'brazil').rows.map((r) => [r.id, r.chip])).toEqual([
            ['pix-qr', 'active'],
            ['br-bank', 'unlock'],
        ])
    })

    it('active rows carry no tap target; offer rows route into the region intent', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'active', 'north-america': 'unlock', latam: 'unlock' } })
        )
        expect(group(groups, 'europe').rows[0].regionPath).toBeUndefined()
        expect(group(groups, 'unitedStates').rows[0]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'north-america' })
        )
        expect(group(groups, 'brazil').rows[0].regionPath).toBe('latam')
    })

    it('a pending verification keeps its own Processing status, never collapsed into Unlock', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'processing' } })
        )
        expect(group(groups, 'brazil').rows[0]).toEqual(
            expect.objectContaining({ chip: 'processing', regionPath: 'latam' })
        )
    })

    it('a banking restriction turns every bank row into Not available and untappable', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: true, card: true } }))
        for (const id of ['brazil', 'argentina', 'unitedStates', 'mexico', 'europe']) {
            for (const row of group(groups, id).rows) {
                expect(row.chip).toBe('notAvailable')
                expect(row.regionPath).toBeUndefined()
            }
        }
        // the always-on layer survives full restriction
        expect(group(groups, 'everywhere').rows[0].chip).toBe('alwaysOn')
        expect(group(groups, 'everywhere').rows[1].chip).toBe('notAvailable')
    })

    it('a card-only restriction leaves bank rows alone', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: false, card: true } }))
        expect(group(groups, 'everywhere').rows[1]).toEqual(expect.objectContaining({ chip: 'notAvailable' }))
        expect(group(groups, 'europe').rows[0].chip).toBe('unlock')
    })

    it('an active card routes to /card for viewing', () => {
        const groups = buildUnlockGroups(base({ card: 'active' }))
        expect(group(groups, 'everywhere').rows[1]).toEqual(expect.objectContaining({ chip: 'active', href: '/card' }))
    })
})
