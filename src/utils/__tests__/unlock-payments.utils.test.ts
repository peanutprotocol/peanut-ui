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
    it('leads with Everywhere: always-on P2P, then crypto', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[0].id).toBe('everywhere')
        expect(groups[0].rows.map((r) => [r.id, r.chip])).toEqual([
            ['p2p', 'alwaysOn'],
            ['crypto', 'alwaysOn'],
        ])
    })

    it('the spending methods are their own group: the card, then QR payments', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[1].id).toBe('spend')
        expect(groups[1].rows.map((r) => [r.id, r.chip])).toEqual([
            ['card', 'unlock'],
            ['qr-pay', 'unlock'],
        ])
    })

    it('QR payments read Available for a user who holds them, either way in', () => {
        const qrOnly = buildUnlockGroups(base({ qrOnly: { brazil: true, argentina: false } }))
        expect(group(qrOnly, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'active' }))

        const latamUnlocked = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'active' } })
        )
        expect(group(latamUnlocked, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'active' }))
    })

    it('QR payments a user does not hold keep the LATAM offer and its tap target', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'unlock', regionPath: 'latam' }))

        const pending = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'processing' } })
        )
        expect(group(pending, 'spend').rows[1].chip).toBe('processing')
    })

    it('a banking restriction takes QR payments away with the bank rows', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: true, card: false } }))
        const qr = group(groups, 'spend').rows[1]
        expect(qr.chip).toBe('notAvailable')
        expect(qr.regionPath).toBeUndefined()
    })

    it('floats the residence group to the top of the regions', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'US' }))
        expect(groups[2].id).toBe('northAmerica')
        expect(groups[2].isYourRegion).toBe(true)
        // stable sort contract: everything else keeps catalog order
        expect(groups.map((g) => g.id)).toEqual(['everywhere', 'spend', 'northAmerica', 'southAmerica', 'europe'])
    })

    it('a Brazilian or Argentine residence floats the shared South America group', () => {
        for (const iso2 of ['BR', 'AR']) {
            const groups = buildUnlockGroups(base({ residenceIso2: iso2 }))
            expect(groups[2].id).toBe('southAmerica')
            expect(groups[2].isYourRegion).toBe(true)
        }
        // Mexico floats North America — it shares the Bridge unlock with the US
        expect(buildUnlockGroups(base({ residenceIso2: 'MX' }))[2].id).toBe('northAmerica')
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
        expect(groups[2].id).toBe('europe')
    })

    it('South America is one merged row carrying both country allowances', () => {
        const groups = buildUnlockGroups(
            base({ regionChips: { europe: 'unlock', 'north-america': 'unlock', latam: 'active' } })
        )
        expect(group(groups, 'southAmerica').rows.map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['sa-bank', 'active', ['BRL', 'ARS']],
        ])
    })

    it('a QR-only Brazil leaves one bank row: the bank unlock is still an offer', () => {
        const groups = buildUnlockGroups(base({ qrOnly: { brazil: true, argentina: false } }))
        expect(group(groups, 'southAmerica').rows.map((r) => [r.id, r.chip])).toEqual([['sa-bank', 'unlock']])
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
        expect(group(groups, 'everywhere').rows.map((r) => r.chip)).toEqual(['alwaysOn', 'alwaysOn'])
        expect(group(groups, 'spend').rows[0].chip).toBe('notAvailable')
    })

    it('a card-only restriction leaves bank rows alone', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: false, card: true } }))
        expect(group(groups, 'spend').rows[0]).toEqual(expect.objectContaining({ chip: 'notAvailable' }))
        expect(group(groups, 'europe').rows[0].chip).toBe('unlock')
    })

    it('an active card routes to /card for viewing', () => {
        const groups = buildUnlockGroups(base({ card: 'active' }))
        expect(group(groups, 'spend').rows[0]).toEqual(expect.objectContaining({ chip: 'active', href: '/card' }))
    })

    it('every bank/QR row carries exactly one leading flag — the always-on rows carry none', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'europe').rows[0].flag).toBe('eu')
        // a row covering two countries shows the first when the user lives in neither
        expect(group(groups, 'northAmerica').rows[0].flag).toBe('us')
        expect(group(groups, 'southAmerica').rows[0].flag).toBe('br')
        expect(group(groups, 'everywhere').rows[0].flag).toBeUndefined() // p2p
        expect(group(groups, 'spend').rows[0].flag).toBeUndefined() // card
    })

    it('a row covering two countries shows the one the user lives in', () => {
        expect(group(buildUnlockGroups(base({ residenceIso2: 'MX' })), 'northAmerica').rows[0].flag).toBe('mx')
        expect(group(buildUnlockGroups(base({ residenceIso2: 'AR' })), 'southAmerica').rows[0].flag).toBe('ar')
    })
})

describe('dedupeHeldBankRows', () => {
    const rowsWith = (regionChips: BuildUnlockGroupsInput['regionChips']) =>
        buildUnlockGroups(base({ regionChips }))
            .filter((g) => g.id !== 'everywhere' && g.id !== 'spend')
            .flatMap((g) => g.rows)
    const bankRows = rowsWith({ europe: 'active', 'north-america': 'active', latam: 'active' })

    it('drops the active sepa row once an active EUR account covers the same corridor', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['EUR']))
        expect(rows.find((r) => r.labelKey === 'sepa')).toBeUndefined()
        expect(rows.find((r) => r.labelKey === 'saBank')).toBeDefined()
    })

    it('drops the merged naBank row once EITHER USD or MXN is active', () => {
        expect(dedupeHeldBankRows(bankRows, new Set(['USD'])).find((r) => r.labelKey === 'naBank')).toBeUndefined()
        expect(dedupeHeldBankRows(bankRows, new Set(['MXN'])).find((r) => r.labelKey === 'naBank')).toBeUndefined()
    })

    it('keeps a row that still has something to do — it is the only way into the fix modal', () => {
        for (const chip of ['unlock', 'processing', 'attention'] as const) {
            const rows = rowsWith({ europe: chip, 'north-america': 'active', latam: 'active' })
            expect(dedupeHeldBankRows(rows, new Set(['EUR'])).find((r) => r.labelKey === 'sepa')).toBeDefined()
        }
    })

    it('never drops the Brazil/Argentina Manteca rows — they are a distinct product from a Bridge VA', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['BRL', 'ARS']))
        expect(rows.find((r) => r.labelKey === 'saBank')).toBeDefined()
    })

    it('is a no-op with no active accounts', () => {
        expect(dedupeHeldBankRows(bankRows, new Set())).toEqual(bankRows)
    })
})
