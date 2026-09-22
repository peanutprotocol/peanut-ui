import { gatingResidenceIso2s, residenceAllows } from '@/features/deposit-accounts/residenceGate'
import { buildUnlockGroups, dedupeHeldBankRows, type BuildUnlockGroupsInput } from '@/utils/unlock-payments.utils'

const base = (over?: Partial<BuildUnlockGroupsInput>): BuildUnlockGroupsInput => ({
    bankChips: { brl: 'unlock', ars: 'unlock', usd: 'unlock', mxn: 'unlock', sepa: 'unlock' },
    canPayQr: false,
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

    it('QR payments read Available on the pay capability alone, with no bank access', () => {
        const payOnly = buildUnlockGroups(base({ canPayQr: true, residenceIso2: 'BR' }))
        expect(group(payOnly, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'active' }))
        // the bank row is a separate permission and stays an offer
        expect(group(payOnly, 'southAmerica').rows[0]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'latam' })
        )
    })

    it('QR payments a user does not hold keep the LATAM offer and its tap target', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'unlock', regionPath: 'latam' }))

        // QR reads the Brazilian corridor: Pix is the bigger of the two.
        const pending = buildUnlockGroups(base({ bankChips: { ...base().bankChips, brl: 'processing' } }))
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

    it('South America is one row per currency, each with its own allowance', () => {
        const groups = buildUnlockGroups(
            base({ bankChips: { ...base().bankChips, brl: 'active' }, residenceIso2: 'BR', secondResidenceIso2: 'AR' })
        )
        expect(group(groups, 'southAmerica').rows.map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['brl-bank', 'active', ['BRL']],
            ['ars-bank', 'unlock', ['ARS']],
        ])
    })

    it('splits the US from Mexico, so one chip can never speak for the other', () => {
        const groups = buildUnlockGroups(base({ bankChips: { ...base().bankChips, usd: 'active' } }))
        expect(group(groups, 'northAmerica').rows.map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['usd-bank', 'active', ['bridge']],
            ['mxn-bank', 'unlock', ['bridge']],
        ])
    })

    it('sibling rows share the one unlock intent behind their two currencies', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'BR', secondResidenceIso2: 'AR' }))
        expect(group(groups, 'southAmerica').rows.map((r) => r.regionPath)).toEqual(['latam', 'latam'])
        expect(group(groups, 'northAmerica').rows.map((r) => r.regionPath)).toEqual(['north-america', 'north-america'])
    })

    it('active rows carry no tap target; offer rows route into the region intent', () => {
        const groups = buildUnlockGroups(
            base({ bankChips: { ...base().bankChips, sepa: 'active' }, residenceIso2: 'BR' })
        )
        expect(group(groups, 'europe').rows[0].regionPath).toBeUndefined()
        expect(group(groups, 'northAmerica').rows[0]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'north-america' })
        )
        expect(group(groups, 'southAmerica').rows[0].regionPath).toBe('latam')
    })

    it('a pending verification keeps its own Processing status, never collapsed into Unlock', () => {
        const groups = buildUnlockGroups(
            base({ bankChips: { ...base().bankChips, brl: 'processing' }, residenceIso2: 'BR' })
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

    it('every bank row carries its own country flag — the always-on rows carry none', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'europe').rows.map((r) => r.flag)).toEqual(['eu'])
        expect(group(groups, 'northAmerica').rows.map((r) => r.flag)).toEqual(['us', 'mx'])
        expect(group(groups, 'southAmerica').rows.map((r) => r.flag)).toEqual(['br', 'ar'])
        expect(group(groups, 'everywhere').rows[0].flag).toBeUndefined() // p2p
        expect(group(groups, 'spend').rows[0].flag).toBeUndefined() // card
    })

    it("a flag is the row's own country, whatever the user's residence", () => {
        expect(group(buildUnlockGroups(base({ residenceIso2: 'MX' })), 'northAmerica').rows.map((r) => r.flag)).toEqual(
            ['us', 'mx']
        )
    })
})

/**
 * The Manteca corridors open a first-party account to residents of that
 * country (Brazil through a client-side CPF-by-residence pre-check). A row that
 * is not an offer must not say Unlock — and must not carry another country's
 * Processing either (the abandoned Argentine ghost on a Portuguese resident's
 * screen, 2026-09-22).
 */
describe('buildUnlockGroups — residence decides the Manteca rows', () => {
    const latamRows = (input?: Partial<BuildUnlockGroupsInput>) =>
        group(buildUnlockGroups(base(input)), 'southAmerica').rows.map((r) => [r.id, r.chip, r.regionPath])

    it('a resident of neither country reads Not available on both, with no tap target', () => {
        expect(latamRows({ residenceIso2: 'PT' })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it('each country opens its own row, and a dual resident gets both', () => {
        expect(latamRows({ residenceIso2: 'BR' })).toEqual([
            ['brl-bank', 'unlock', 'latam'],
            ['ars-bank', 'notAvailable', undefined],
        ])
        expect(latamRows({ residenceIso2: 'PT', secondResidenceIso2: 'AR' })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'unlock', 'latam'],
        ])
        expect(latamRows({ residenceIso2: 'BR', secondResidenceIso2: 'AR' })).toEqual([
            ['brl-bank', 'unlock', 'latam'],
            ['ars-bank', 'unlock', 'latam'],
        ])
    })

    it('an unknown residence fails closed, as the backend does', () => {
        expect(latamRows({ residenceIso2: null })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it("another country's mid-flight rail is not narrated on a row that is not offered", () => {
        expect(latamRows({ residenceIso2: 'PT', bankChips: { ...base().bankChips, ars: 'processing' } })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it('a rail that already works stays a fact after a move', () => {
        expect(latamRows({ residenceIso2: 'PT', bankChips: { ...base().bankChips, brl: 'active' } })).toEqual([
            ['brl-bank', 'active', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it('the Bridge rows and QR payments are untouched by it', () => {
        const groups = buildUnlockGroups(base({ residenceIso2: 'PT' }))
        expect(group(groups, 'europe').rows[0].chip).toBe('unlock')
        expect(group(groups, 'northAmerica').rows.map((r) => r.chip)).toEqual(['unlock', 'unlock'])
        // paying a QR code needs no first-party account, so the offer stands
        expect(group(groups, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'unlock', regionPath: 'latam' }))
    })
})

describe('dedupeHeldBankRows', () => {
    const rowsWith = (bankChips: BuildUnlockGroupsInput['bankChips']) =>
        buildUnlockGroups(base({ bankChips }))
            .filter((g) => g.id !== 'everywhere' && g.id !== 'spend')
            .flatMap((g) => g.rows)
    const allActive = { brl: 'active', ars: 'active', usd: 'active', mxn: 'active', sepa: 'active' } as const
    const bankRows = rowsWith(allActive)

    it('drops the active sepa row once an active EUR account covers the same corridor', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['EUR']))
        expect(rows.find((r) => r.labelKey === 'sepa')).toBeUndefined()
        expect(rows.find((r) => r.labelKey === 'brl')).toBeDefined()
    })

    it('drops only the currency the account covers, now the rows are split', () => {
        const usd = dedupeHeldBankRows(bankRows, new Set(['USD']))
        expect(usd.find((r) => r.labelKey === 'usd')).toBeUndefined()
        expect(usd.find((r) => r.labelKey === 'mxn')).toBeDefined()

        const mxn = dedupeHeldBankRows(bankRows, new Set(['MXN']))
        expect(mxn.find((r) => r.labelKey === 'mxn')).toBeUndefined()
        expect(mxn.find((r) => r.labelKey === 'usd')).toBeDefined()
    })

    it('keeps a row that still has something to do — it is the only way into the fix modal', () => {
        for (const chip of ['unlock', 'processing', 'attention'] as const) {
            const rows = rowsWith({ ...allActive, sepa: chip })
            expect(dedupeHeldBankRows(rows, new Set(['EUR'])).find((r) => r.labelKey === 'sepa')).toBeDefined()
        }
    })

    it('never drops the Brazil/Argentina Manteca rows — they are a distinct product from a Bridge VA', () => {
        const rows = dedupeHeldBankRows(bankRows, new Set(['BRL', 'ARS']))
        expect(rows.find((r) => r.labelKey === 'brl')).toBeDefined()
        expect(rows.find((r) => r.labelKey === 'ars')).toBeDefined()
    })

    it('is a no-op with no active accounts', () => {
        expect(dedupeHeldBankRows(bankRows, new Set())).toEqual(bankRows)
    })
})

/**
 * One residence derivation for every residence gate: the Unlock payments rows
 * and the top-up flows behind them read the same countries, verified first.
 */
describe('gatingResidenceIso2s', () => {
    it('a verified residence outranks a declared one, as on the backend', () => {
        expect(gatingResidenceIso2s({ verified: 'PT', declared: 'BR' })).toEqual(['PT'])
    })

    it('a declared residence counts while nothing is verified, and a second one beside it', () => {
        expect(gatingResidenceIso2s({ verified: null, declared: 'br', second: 'AR' })).toEqual(['BR', 'AR'])
        expect(gatingResidenceIso2s({})).toEqual([])
    })

    it('the row and the top-up agree: verified PT + declared BR reads not offered on both', () => {
        const residences = gatingResidenceIso2s({ verified: 'PT', declared: 'BR' })
        expect(residenceAllows('PIX_BR', residences)).toBe(false)
        const groups = buildUnlockGroups(base({ residenceIso2: 'PT' }))
        expect(group(groups, 'southAmerica').rows[0].chip).toBe('notAvailable')
    })
})
