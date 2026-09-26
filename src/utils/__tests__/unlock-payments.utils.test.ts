import { gatingResidenceIso2s, residenceAllows } from '@/features/deposit-accounts/residenceGate'
import {
    buildBankRows,
    withPixSend,
    buildUnlockGroups,
    dedupeHeldBankRows,
    type BankRowsInput,
    type BuildUnlockGroupsInput,
} from '@/utils/unlock-payments.utils'

const UNLOCK_ALL = { brl: 'unlock', ars: 'unlock', usd: 'unlock', mxn: 'unlock', sepa: 'unlock' } as const

const base = (over?: Partial<BuildUnlockGroupsInput>): BuildUnlockGroupsInput => ({
    bankChips: UNLOCK_ALL,
    canPayQr: false,
    restrictions: { banking: false, card: false },
    card: 'get',
    ...over,
})

const bank = (over?: Partial<BankRowsInput>) =>
    buildBankRows({
        bankChips: UNLOCK_ALL,
        restrictions: { banking: false, card: false },
        residenceIso2: null,
        isEuropeResidence: false,
        ...over,
    })

const group = (groups: ReturnType<typeof buildUnlockGroups>, id: string) => {
    const found = groups.find((g) => g.id === id)
    if (!found) throw new Error(`missing group ${id}`)
    return found
}

/** the bank rows of these currencies, in the order they render */
const rowsOf = (rows: ReturnType<typeof buildBankRows>, ...keys: string[]) =>
    rows.filter((row) => keys.includes(row.labelKey))

describe('buildUnlockGroups', () => {
    it('leads with Everywhere: always-on P2P, then crypto', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[0].id).toBe('everywhere')
        expect(groups[0].rows.map((r) => [r.id, r.chip])).toEqual([
            ['p2p', 'alwaysOn'],
            ['crypto', 'alwaysOn'],
        ])
    })

    // TASK-23054: sending to a Pix key is the BRL row on Accounts (`withPixSend`), not a Spend row
    it('the spending methods are their own group: the card, then QR payments', () => {
        const groups = buildUnlockGroups(base())
        expect(groups[1].id).toBe('spend')
        expect(groups[1].rows.map((r) => [r.id, r.chip])).toEqual([
            ['card', 'unlock'],
            ['qr-pay', 'unlock'],
        ])
    })

    it('QR payments name the countries they pay in as flags, Brazil first', () => {
        expect(group(buildUnlockGroups(base()), 'spend').rows[1].flags).toEqual(['BR', 'AR'])
    })

    it('holds only the two lead groups: the bank rows are their own shared list', () => {
        expect(buildUnlockGroups(base()).map((g) => g.id)).toEqual(['everywhere', 'spend'])
    })

    it('QR payments read Available on the pay capability alone, with no bank access', () => {
        const payOnly = buildUnlockGroups(base({ canPayQr: true }))
        expect(group(payOnly, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'active' }))
        // the bank row is a separate permission and stays an offer
        expect(rowsOf(bank({ residenceIso2: 'BR' }), 'brl')[0]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'latam' })
        )
    })

    it('QR payments a user does not hold keep the LATAM offer and its tap target', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'spend').rows[1]).toEqual(expect.objectContaining({ chip: 'unlock', regionPath: 'latam' }))

        // QR reads the Brazilian corridor: Pix is the bigger of the two.
        const pending = buildUnlockGroups(base({ bankChips: { ...UNLOCK_ALL, brl: 'processing' } }))
        expect(group(pending, 'spend').rows[1].chip).toBe('processing')
    })

    it('a banking restriction takes QR payments away with the bank rows', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: true, card: false } }))
        const qr = group(groups, 'spend').rows[1]
        expect(qr.chip).toBe('notAvailable')
        expect(qr.regionPath).toBeUndefined()
    })

    it('the always-on layer survives full restriction, and the card goes', () => {
        const groups = buildUnlockGroups(base({ restrictions: { banking: true, card: true } }))
        expect(group(groups, 'everywhere').rows.map((r) => r.chip)).toEqual(['alwaysOn', 'alwaysOn'])
        expect(group(groups, 'spend').rows[0].chip).toBe('notAvailable')
    })

    it('a card-only restriction takes the card and leaves the bank rows alone', () => {
        expect(
            group(buildUnlockGroups(base({ restrictions: { banking: false, card: true } })), 'spend').rows[0]
        ).toEqual(expect.objectContaining({ chip: 'notAvailable' }))
        expect(rowsOf(bank({ restrictions: { banking: false, card: true } }), 'sepa')[0].chip).toBe('unlock')
    })

    it('an active card routes to /card for viewing', () => {
        const groups = buildUnlockGroups(base({ card: 'active' }))
        expect(group(groups, 'spend').rows[0]).toEqual(expect.objectContaining({ chip: 'active', href: '/card' }))
    })

    it('the always-on and spend rows carry no flag', () => {
        const groups = buildUnlockGroups(base())
        expect(group(groups, 'everywhere').rows[0].flag).toBeUndefined() // p2p
        expect(group(groups, 'spend').rows[0].flag).toBeUndefined() // card
    })
})

describe('buildBankRows', () => {
    it("floats the residence region's rows to the top, the rest in catalog order", () => {
        expect(bank({ residenceIso2: 'US' }).map((r) => r.labelKey)).toEqual(['usd', 'mxn', 'brl', 'ars', 'sepa'])
        expect(bank().map((r) => r.labelKey)).toEqual(['brl', 'ars', 'usd', 'mxn', 'sepa'])
    })

    it('a Brazilian or Argentine residence floats the shared South America rows; Mexico floats the US', () => {
        for (const iso2 of ['BR', 'AR']) expect(bank({ residenceIso2: iso2 })[0].labelKey).toBe('brl')
        expect(bank({ residenceIso2: 'MX' })[0].labelKey).toBe('usd')
    })

    it('a second residence floats its region too, so a dual resident sees both first', () => {
        const keys = bank({ residenceIso2: 'DE', isEuropeResidence: true, secondResidenceIso2: 'BR' }).map(
            (r) => r.labelKey
        )
        expect(keys).toEqual(['brl', 'ars', 'sepa', 'usd', 'mxn'])
    })

    it('a European residence floats the euro row', () => {
        expect(bank({ residenceIso2: 'DE', isEuropeResidence: true })[0].labelKey).toBe('sepa')
    })

    it('South America is one row per currency, each with its own allowance', () => {
        const rows = bank({
            bankChips: { ...UNLOCK_ALL, brl: 'active' },
            residenceIso2: 'BR',
            secondResidenceIso2: 'AR',
        })
        expect(rowsOf(rows, 'brl', 'ars').map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['brl-bank', 'active', ['BRL']],
            ['ars-bank', 'unlock', ['ARS']],
        ])
    })

    it('splits the US from Mexico, so one chip can never speak for the other', () => {
        const rows = bank({ bankChips: { ...UNLOCK_ALL, usd: 'active' } })
        expect(rowsOf(rows, 'usd', 'mxn').map((r) => [r.id, r.chip, r.limitRefs])).toEqual([
            ['usd-bank', 'active', ['bridge']],
            ['mxn-bank', 'unlock', ['bridge']],
        ])
    })

    it('sibling rows share the one unlock intent behind their two currencies', () => {
        const rows = bank({ residenceIso2: 'BR', secondResidenceIso2: 'AR' })
        expect(rowsOf(rows, 'brl', 'ars').map((r) => r.regionPath)).toEqual(['latam', 'latam'])
        expect(rowsOf(rows, 'usd', 'mxn').map((r) => r.regionPath)).toEqual(['north-america', 'north-america'])
    })

    it('active rows carry no tap target; offer rows route into the region intent', () => {
        const rows = bank({ bankChips: { ...UNLOCK_ALL, sepa: 'active' }, residenceIso2: 'BR' })
        expect(rowsOf(rows, 'sepa')[0].regionPath).toBeUndefined()
        expect(rowsOf(rows, 'usd')[0]).toEqual(expect.objectContaining({ chip: 'unlock', regionPath: 'north-america' }))
        expect(rowsOf(rows, 'brl')[0].regionPath).toBe('latam')
    })

    it('a pending verification keeps its own Processing status, never collapsed into Unlock', () => {
        expect(
            rowsOf(bank({ bankChips: { ...UNLOCK_ALL, brl: 'processing' }, residenceIso2: 'BR' }), 'brl')[0]
        ).toEqual(expect.objectContaining({ chip: 'processing', regionPath: 'latam' }))
    })

    it('a banking restriction turns every bank row into Not available, and says it is the country', () => {
        for (const row of bank({ restrictions: { banking: true, card: true } })) {
            expect(row.chip).toBe('notAvailable')
            expect(row.regionPath).toBeUndefined()
            expect(row.unavailableBecause).toBe('restricted-country')
        }
    })

    it('every bank row carries its own flag, currency code and corridor', () => {
        expect(bank().map((r) => [r.labelKey, r.flag, r.currency, r.corridor])).toEqual([
            ['brl', 'br', 'BRL', 'PIX_BR'],
            ['ars', 'ar', 'ARS', 'BANK_TRANSFER_AR'],
            ['usd', 'us', 'USD', 'ACH_US'],
            ['mxn', 'mx', 'MXN', 'SPEI_MX'],
            ['sepa', 'eu', 'EUR', 'SEPA_EU'],
        ])
    })
})

/**
 * The Manteca corridors open a first-party account to residents of that
 * country (Brazil through a client-side CPF-by-residence pre-check). A row that
 * is not an offer must not say Unlock — and must not carry another country's
 * Processing either (the abandoned Argentine ghost on a Portuguese resident's
 * screen, 2026-09-22).
 */
describe('buildBankRows — residence decides the Manteca rows', () => {
    const latamRows = (input?: Partial<BankRowsInput>) =>
        rowsOf(bank(input), 'brl', 'ars').map((r) => [r.id, r.chip, r.regionPath])

    it('a resident of neither country reads Not available on both, with no tap target, and residence is why', () => {
        expect(latamRows({ residenceIso2: 'PT' })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
        expect(rowsOf(bank({ residenceIso2: 'PT' }), 'brl')[0].unavailableBecause).toBe('residence')
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
        expect(latamRows({ residenceIso2: 'PT', bankChips: { ...UNLOCK_ALL, ars: 'processing' } })).toEqual([
            ['brl-bank', 'notAvailable', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it('a rail that already works stays a fact after a move', () => {
        expect(latamRows({ residenceIso2: 'PT', bankChips: { ...UNLOCK_ALL, brl: 'active' } })).toEqual([
            ['brl-bank', 'active', undefined],
            ['ars-bank', 'notAvailable', undefined],
        ])
    })

    it('the Bridge rows and QR payments are untouched by it', () => {
        const rows = bank({ residenceIso2: 'PT' })
        expect(rowsOf(rows, 'sepa')[0].chip).toBe('unlock')
        expect(rowsOf(rows, 'usd', 'mxn').map((r) => r.chip)).toEqual(['unlock', 'unlock'])
        // paying a QR code needs no first-party account, so the offer stands
        expect(group(buildUnlockGroups(base()), 'spend').rows[1]).toEqual(
            expect.objectContaining({ chip: 'unlock', regionPath: 'latam' })
        )
    })
})

describe('dedupeHeldBankRows', () => {
    const allActive = { brl: 'active', ars: 'active', usd: 'active', mxn: 'active', sepa: 'active' } as const
    const rowsWith = (bankChips: BankRowsInput['bankChips']) => bank({ bankChips })
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
 * One residence derivation for every residence gate: the bank rows and the
 * top-up flows behind them read the same countries, verified first.
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
        expect(rowsOf(bank({ residenceIso2: 'PT' }), 'brl')[0].chip).toBe('notAvailable')
    })
})

/**
 * Adding reais by Pix is for Brazilian residents; sending to any Pix key is not
 * (hugo, 2026-09-24, QA-12). Accounts and payments lets the BRL row say so.
 */
describe('withPixSend', () => {
    const brl = (rows: ReturnType<typeof buildBankRows>) => rows.find((row) => row.labelKey === 'brl')!
    const canSend = { canPay: true, brlChip: 'unlock' } as const
    const cannotSend = { canPay: false, brlChip: 'unlock' } as const

    it('a non-resident who can pay a Pix key reads Available, and the tap opens Pix key sending', () => {
        const rows = withPixSend(bank({ residenceIso2: 'PT' }), canSend)
        expect(brl(rows)).toEqual(
            expect.objectContaining({
                chip: 'active',
                note: 'pixSendNote',
                href: '/withdraw/manteca?method=pix&country=brazil',
            })
        )
        expect(brl(rows).unavailableBecause).toBeUndefined()
        expect(brl(rows).regionPath).toBeUndefined()
    })

    // Chip review on ui#3400: the legacy Bridge-only cohort pays by QR through
    // the region fallback, but /qr-pay gates on the Manteca pay capability, so
    // a key link would end in a verification prompt. The view passes that
    // capability alone, never the QR row's fallback.
    it('a non-resident who cannot pay yet gets the LATAM offer, never a link', () => {
        const rows = withPixSend(bank({ residenceIso2: 'PT' }), cannotSend)
        expect(brl(rows)).toEqual(expect.objectContaining({ chip: 'unlock', note: 'pixSendNote', regionPath: 'latam' }))
        expect(brl(rows).href).toBeUndefined()
    })

    it('a Manteca verification in flight reads as the BRL corridor does', () => {
        const rows = withPixSend(bank({ residenceIso2: 'PT' }), { canPay: false, brlChip: 'processing' })
        expect(brl(rows).chip).toBe('processing')
    })

    it('leaves a resident, a banking restriction and every other row alone', () => {
        const resident = bank({ residenceIso2: 'BR' })
        expect(withPixSend(resident, canSend)).toEqual(resident)
        const restricted = bank({ residenceIso2: 'PT', restrictions: { banking: true, card: false } })
        expect(withPixSend(restricted, canSend)).toEqual(restricted)
        const ars = withPixSend(bank({ residenceIso2: 'PT' }), canSend).find((r) => r.labelKey === 'ars')
        expect(ars?.chip).toBe('notAvailable')
    })
})
