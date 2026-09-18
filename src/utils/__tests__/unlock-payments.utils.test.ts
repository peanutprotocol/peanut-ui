import { buildUnlockGroups, dedupeHeldBankRows, type BuildUnlockGroupsInput } from '@/utils/unlock-payments.utils'

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
    it('leads with Everywhere: always-on P2P, then the card, then crypto', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[0].id).toBe('everywhere')
        expect(groups[0].rows.map((r) => [r.id, r.chip])).toEqual([
            ['p2p', 'alwaysOn'],
            ['card', 'unlock'],
            ['crypto', 'alwaysOn'],
        ])
    })

    it('floats the residence group to the top of the regions', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'US' }))
        expect(groups[1].id).toBe('northAmerica')
        expect(groups[1].isYourRegion).toBe(true)
        // stable sort contract: everything else keeps catalog order
        expect(groups.map((g) => g.id)).toEqual(['everywhere', 'northAmerica', 'southAmerica', 'europe'])
    })

    it('a Brazilian or Argentine residence floats the shared South America group', () => {
        for (const iso2 of ['BR', 'AR']) {
            const groups = buildUnlockGroups(base({ residenceIso2: iso2 }))
            expect(groups[1].id).toBe('southAmerica')
            expect(groups[1].isYourRegion).toBe(true)
        }
        // Mexico floats North America — it shares the Bridge unlock with the US
        expect(buildUnlockGroups(base({ residenceIso2: 'MX' }))[1].id).toBe('northAmerica')
    })

    it('a second residence tags its region too, so a dual resident sees both as theirs', () => {
        const groups = buildUnlockGroups(
            base({ residenceIso2: 'DE', isEuropeResidence: true, secondResidenceIso2: 'BR' })
        )
        expect(group(groups, 'europe').isYourRegion).toBe(true)
        expect(group(groups, 'southAmerica').isYourRegion).toBe(true)
        expect(group(groups, 'northAmerica').isYourRegion).toBe(false)
    })

    it('marks Europe as your region for a European residence', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'DE', isEuropeResidence: true }))
        expect(groups[1].id).toBe('europe')
    })

    it('South America is one merged row carrying both country allowances', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'active' } })
        )
        expect(group(groups, 'southAmerica').rows.map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['sa-bank', 'active', ['BRL', 'ARS']],
        ])
    })

    it('a QR-only Brazil splits the merged row: QR active, bank still an offer', () => {
        const groups = buildUnlockGroups(base({ qrOnly: { brazil: true, argentina: false } }))
        expect(group(groups, 'southAmerica').rows.map((r) => [r.id, r.chip])).toEqual([
            ['pix-qr', 'active'],
            ['br-bank', 'unlock'],
            ['ar-qr-bank', 'unlock'],
        ])
    })

    it('North America is one merged US + Mexico row behind the one Bridge unlock', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'northAmerica').rows.map((r) => [r.id, r.limitRefs])).toEqual([['na-bank', ['bridge']]])
    })

    it('active rows carry no tap target; offer rows route into the region intent', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'active', 'north-america': 'unlock', latam: 'unlock' } })
        )
        expect(group(groups, 'europe').rows[0].regionPath).toBeUndefined()
        expect(group(groups, 'northAmerica').rows[0]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'north-america' })
        )
        expect(group(groups, 'southAmerica').rows[0].regionPath).toBe('latam')
    })

    it('a pending verification keeps its own Processing status, never collapsed into Unlock', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'processing' } })
        )
        expect(group(groups, 'southAmerica').rows[0]).toEqual(
            expect.objectContaining({ chip: 'processing', regionPath: 'latam' })
        )
    })

    it('a banking restriction turns every bank row into Not available and untappable', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: true, card: true } }))
        for (const id of ['southAmerica', 'northAmerica', 'europe']) {
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

    it('every bank/QR row carries a leading flag, keyed to its currency — the always-on rows carry none', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'europe').rows[0].flags).toEqual(['eu'])
        expect(group(groups, 'northAmerica').rows[0].flags).toEqual(['us', 'mx'])
        expect(group(groups, 'southAmerica').rows[0].flags).toEqual(['br', 'ar'])
        expect(group(groups, 'everywhere').rows[0].flags).toBeUndefined() // p2p
        expect(group(groups, 'everywhere').rows[1].flags).toBeUndefined() // card
    })

    it('a QR-only Brazil split still flags both split-off Brazil rows BR — the split is by product, not by country', () => {
        const groups = buildUnlockGroups(base({ qrOnly: { brazil: true, argentina: false } }))
        const rows = group(groups, 'southAmerica').rows
        expect(rows.find((r) => r.labelKey === 'pixQr')?.flags).toEqual(['br'])
        expect(rows.find((r) => r.labelKey === 'brBank')?.flags).toEqual(['br'])
        expect(rows.find((r) => r.labelKey === 'arQrBank')?.flags).toEqual(['ar'])
    })
})

describe('dedupeHeldBankRows', () => {
    const groups = buildUnlockGroups(base())
    const bankRows = groups.filter((g) => g.id !== 'everywhere').flatMap((g) => g.rows)

    it('drops the sepa row once a held EUR VA covers the same corridor', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['EUR']))
        expect(rows.find((r) => r.labelKey === 'sepa')).toBeUndefined()
        expect(rows.find((r) => r.labelKey === 'saBank')).toBeDefined()
    })

    it('drops the merged naBank row once EITHER USD or MXN is held', () => {
        expect(dedupeHeldBankRows(bankRows, new Set(['USD'])).find((r) => r.labelKey === 'naBank')).toBeUndefined()
        expect(dedupeHeldBankRows(bankRows, new Set(['MXN'])).find((r) => r.labelKey === 'naBank')).toBeUndefined()
    })

    it('never drops the Brazil/Argentina Manteca rows — they are a distinct product from a Bridge VA', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['BRL', 'ARS']))
        expect(rows.find((r) => r.labelKey === 'saBank')).toBeDefined()
    })

    it('is a no-op with no held currencies', () => {
        expect(dedupeHeldBankRows(bankRows, new Set())).toEqual(bankRows)
    })
})
