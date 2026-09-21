/**
 * Group/row derivation for the Unlock payments screen (the Unlocked Regions
 * rework). Regions survive as presentational GROUPS; every ROW is a concrete
 * product with a live status chip. The unlock verb attaches to products
 * ("Euro bank transfers · Unlock"), never to abstract regions, and the tap target
 * stays the existing region-intent KYC machinery.
 *
 * Pure: the view computes per-region chips from the capability model and
 * passes them in, so this stays unit-testable with plain values.
 */

export type UnlockChip = 'active' | 'alwaysOn' | 'unlock' | 'processing' | 'attention' | 'notAvailable'

/** Chip for a bank region before residence restrictions are applied. */
export type BankRegionChip = Exclude<UnlockChip, 'alwaysOn' | 'notAvailable'>

/** Exact key unions so next-intl's typed t() accepts the derived keys. */
export type UnlockRowLabelKey = 'p2p' | 'card' | 'crypto' | 'qrPay' | 'saBank' | 'naBank' | 'sepa'
export type UnlockGroupLabelKey = 'everywhere' | 'spend' | 'southAmerica' | 'northAmerica' | 'europe'

export interface UnlockRow {
    id: string
    /** i18n key under profile.unlockPayments.rows */
    labelKey: UnlockRowLabelKey
    icon: 'qr-code' | 'bank' | 'credit-card' | 'wallet' | 'coins'
    chip: UnlockChip
    /** region path the tap routes into (existing region modal machinery); absent = not tappable */
    regionPath?: 'europe' | 'north-america' | 'latam'
    /** card row only: navigate instead of opening a region modal */
    href?: string
    /**
     * Which limits apply once the row is active: Manteca per-currency
     * allowances (BRL/ARS) and/or the shared Bridge per-transaction cap.
     * A merged row (one unlock covering two countries) carries several.
     */
    limitRefs?: readonly ('BRL' | 'ARS' | 'bridge')[]
    /**
     * Currency-first accounts list (2026-09-18): the flag that replaces the
     * generic qr-code/bank icon as this row's leading glyph. One per row: a
     * ListItem leading is one element, and two flags on the merged rows read
     * as clutter. A row whose one unlock covers two countries (naBank, the
     * unsplit saBank) shows the user's own country, else the first listed.
     * Absent on `p2p`/`card`, which keep their icons in the "Peanut" group.
     */
    flag?: string
}

export interface UnlockGroup {
    id: UnlockGroupLabelKey
    /** i18n key under profile.unlockPayments.groups */
    labelKey: UnlockGroupLabelKey
    isYourRegion: boolean
    rows: UnlockRow[]
}

export interface BuildUnlockGroupsInput {
    /** pre-restriction chip per bank region, derived from the capability rails */
    regionChips: { europe: BankRegionChip; 'north-america': BankRegionChip; latam: BankRegionChip }
    /** whether the user can pay by QR in Brazil or Argentina today (the `pay` capability) */
    canPayQr: boolean
    restrictions: { banking: boolean; card: boolean }
    card: 'active' | 'get' | 'notAvailable'
    /** ISO-2 residence (verified preferred, else declared) for the "Your region" tag */
    residenceIso2: string | null
    /** second declared residence (device mirror), so both regions carry the tag */
    secondResidenceIso2?: string | null
    /** whether the residence country is served by Bridge's Europe coverage */
    isEuropeResidence: boolean
}

const CARD_ROW_BASE = { id: 'card', labelKey: 'card', icon: 'credit-card' } as const

/** The countries each row covers, as flag codes — see `UnlockRow.flag`. `p2p`/`card` carry none. */
const ROW_FLAGS: Partial<Record<UnlockRowLabelKey, readonly string[]>> = {
    saBank: ['br', 'ar'],
    naBank: ['us', 'mx'],
    sepa: ['eu'],
}

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { regionChips, canPayQr, restrictions, card, residenceIso2, secondResidenceIso2, isEuropeResidence } = input
    const residences = new Set([residenceIso2, secondResidenceIso2].filter(Boolean) as string[])

    const flagFor = (labelKey: UnlockRowLabelKey): string | undefined => {
        const countries = ROW_FLAGS[labelKey]
        return countries?.find((iso2) => residences.has(iso2.toUpperCase())) ?? countries?.[0]
    }

    const bankChip = (chip: BankRegionChip): UnlockChip => (restrictions.banking ? 'notAvailable' : chip)
    const bankRow = (
        id: string,
        labelKey: UnlockRowLabelKey,
        icon: UnlockRow['icon'],
        regionPath: NonNullable<UnlockRow['regionPath']>,
        limitRefs: NonNullable<UnlockRow['limitRefs']>
    ): UnlockRow => {
        const chip = bankChip(regionChips[regionPath])
        return {
            id,
            labelKey,
            icon,
            chip,
            limitRefs,
            flag: flagFor(labelKey),
            // active and unavailable rows are facts, not actions
            ...(chip === 'active' || chip === 'notAvailable' ? {} : { regionPath }),
        }
    }

    const cardChip: UnlockChip =
        restrictions.card || card === 'notAvailable' ? 'notAvailable' : card === 'active' ? 'active' : 'unlock'
    const cardRow: UnlockRow = {
        ...CARD_ROW_BASE,
        chip: cardChip,
        ...(cardChip === 'notAvailable' ? {} : { href: '/card' }),
    }

    // QR payments in Brazil and Argentina are a SPENDING method, not a way to
    // add or withdraw money, so they are their own row in the Spend section
    // rather than a word inside a bank row. It reads its OWN capability:
    // paying by QR and moving money through a bank are different permissions
    // on the same rails, and most verified users hold the first without the
    // second. Anyone without it gets the LATAM offer chip, and the tap lands
    // on the same region intent the merged bank row uses.
    const qrChip: UnlockChip = restrictions.banking ? 'notAvailable' : canPayQr ? 'active' : regionChips.latam
    const qrRow: UnlockRow = {
        id: 'qr-pay',
        labelKey: 'qrPay',
        icon: 'qr-code',
        chip: qrChip,
        limitRefs: ['BRL', 'ARS'],
        ...(qrChip === 'active' || qrChip === 'notAvailable' ? {} : { regionPath: 'latam' as const }),
    }

    const groups: UnlockGroup[] = [
        {
            id: 'everywhere',
            labelKey: 'everywhere',
            isYourRegion: false,
            rows: [
                { id: 'p2p', labelKey: 'p2p', icon: 'wallet', chip: 'alwaysOn' },
                // On-chain, no KYC and no Peanut unlock gates it — same
                // always-on layer as P2P (regression fix, ui#3271 QA pass 2:
                // the currency-first merge dropped this row entirely).
                { id: 'crypto', labelKey: 'crypto', icon: 'coins', chip: 'alwaysOn' },
            ],
        },
        // Spending, named apart from adding and withdrawing money (2026-09-21):
        // the card and QR payments both pay a shop, and neither moves money
        // between a bank and Peanut.
        {
            id: 'spend',
            labelKey: 'spend',
            isYourRegion: false,
            rows: [cardRow, qrRow],
        },
        // Brazil + Argentina share one Manteca verification (one unlock opens
        // both), so they present as a single South America group with ONE
        // merged row — separate country rows would imply two unlocks where
        // there is only one. Mexico is NOT here — it rides Bridge with the US
        // (LATAM would wrongly claim it). The row used to split per country
        // for the QR-only overlay; QR is now its own Spend row, so the bank
        // row states the one thing left to state: which currencies move
        // between a bank and Peanut, behind one unlock.
        {
            id: 'southAmerica',
            labelKey: 'southAmerica',
            isYourRegion: residences.has('BR') || residences.has('AR'),
            rows: [bankRow('sa-bank', 'saBank', 'bank', 'latam', ['BRL', 'ARS'])],
        },
        // US + Mexico share one Bridge verification (ACH/Wire and SPEI unlock
        // together), so they present as one North America group with one
        // merged row — a single unlock action for a single flow.
        {
            id: 'northAmerica',
            labelKey: 'northAmerica',
            isYourRegion: residences.has('US') || residences.has('MX'),
            rows: [bankRow('na-bank', 'naBank', 'bank', 'north-america', ['bridge'])],
        },
        {
            id: 'europe',
            labelKey: 'europe',
            isYourRegion: isEuropeResidence,
            rows: [bankRow('sepa', 'sepa', 'bank', 'europe', ['bridge'])],
        },
    ]

    // Everywhere and Spend lead (the always-on layer and the spending methods
    // are not regions), then the user's own region, then the rest in catalog
    // order. The view renders the two lead groups in its own sections.
    const [everywhere, spend, ...rest] = groups
    rest.sort((a, b) => Number(b.isYourRegion) - Number(a.isYourRegion))
    return [everywhere, spend, ...rest]
}

/**
 * The bank/QR rows that survive the currency-first "Your accounts" merge
 * (2026-09-18), once a VA account already covers the same corridor.
 *
 * A row goes only when nothing is lost with it: the account is ACTIVE and the
 * row's own chip is `active`. A revoked or provisioning account does not cover
 * the corridor, and a row with any other chip is the user's only way into the
 * fix or rejection modal for that rail.
 *
 * Scoped to the two rows that map 1:1 onto a single VA product: `sepa`
 * (Europe/EUR) and `naBank` (North America, one Bridge unlock behind both
 * USD and MXN). Brazil/Argentina are deliberately left alone — the Manteca
 * PIX/QR rows are a distinct product from any Bridge BRL/ARS VA, not a
 * duplicate of it, so both may legitimately show at once.
 */
export function dedupeHeldBankRows(
    rows: readonly UnlockRow[],
    activeAccountCurrencies: ReadonlySet<string>
): UnlockRow[] {
    return rows.filter((row) => {
        if (row.chip !== 'active') return true
        if (row.labelKey === 'sepa') return !activeAccountCurrencies.has('EUR')
        if (row.labelKey === 'naBank') return !activeAccountCurrencies.has('USD') && !activeAccountCurrencies.has('MXN')
        return true
    })
}
