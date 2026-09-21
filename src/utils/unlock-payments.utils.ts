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
export type UnlockRowLabelKey = 'p2p' | 'card' | 'crypto' | 'qrPay' | 'brl' | 'ars' | 'usd' | 'mxn' | 'sepa'

/** The bank corridors, one per currency (2026-09-21). */
export type BankRowKey = Extract<UnlockRowLabelKey, 'brl' | 'ars' | 'usd' | 'mxn' | 'sepa'>
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
     */
    limitRefs?: readonly ('BRL' | 'ARS' | 'bridge')[]
    /**
     * Currency-first accounts list (2026-09-18): the flag that replaces the
     * generic qr-code/bank icon as this row's leading glyph. One per row, and
     * since 2026-09-21 one country per row, so it is simply that country's.
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
    /**
     * Pre-restriction chip per bank corridor, one per currency. The view
     * derives each from the rails of that corridor's OWN country, so a chip
     * can never claim a currency the user cannot move.
     */
    bankChips: Record<BankRowKey, BankRegionChip>
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

/**
 * The bank corridors, in catalog order within their group.
 *
 * One row per CURRENCY (ruled 2026-09-21, hugo — "prob makes sense to split
 * usa and Mexico"). The merged rows claimed one status for two currencies: a
 * user with a working US rail and no Mexican one read "Available" on a row
 * that named both. `country` is the rail jurisdiction the view scopes each
 * chip to; `regionPath` is the unlock intent behind the tap, which stays
 * shared — Brazil and Argentina open on one Manteca verification, the US and
 * Mexico on one Bridge verification.
 */
const BANK_ROWS: readonly {
    key: BankRowKey
    group: Extract<UnlockGroupLabelKey, 'southAmerica' | 'northAmerica' | 'europe'>
    country: string
    flag: string
    regionPath: NonNullable<UnlockRow['regionPath']>
    limitRefs: NonNullable<UnlockRow['limitRefs']>
}[] = [
    { key: 'brl', group: 'southAmerica', country: 'BR', flag: 'br', regionPath: 'latam', limitRefs: ['BRL'] },
    { key: 'ars', group: 'southAmerica', country: 'AR', flag: 'ar', regionPath: 'latam', limitRefs: ['ARS'] },
    {
        key: 'usd',
        group: 'northAmerica',
        country: 'US',
        flag: 'us',
        regionPath: 'north-america',
        limitRefs: ['bridge'],
    },
    {
        key: 'mxn',
        group: 'northAmerica',
        country: 'MX',
        flag: 'mx',
        regionPath: 'north-america',
        limitRefs: ['bridge'],
    },
    { key: 'sepa', group: 'europe', country: 'EU', flag: 'eu', regionPath: 'europe', limitRefs: ['bridge'] },
]

/** The rail jurisdiction each bank row reads its chip from. */
export const BANK_ROW_COUNTRIES: Record<BankRowKey, string> = Object.fromEntries(
    BANK_ROWS.map((row) => [row.key, row.country])
) as Record<BankRowKey, string>

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { bankChips, canPayQr, restrictions, card, residenceIso2, secondResidenceIso2, isEuropeResidence } = input
    const residences = new Set([residenceIso2, secondResidenceIso2].filter(Boolean) as string[])

    const bankRow = (spec: (typeof BANK_ROWS)[number]): UnlockRow => {
        const chip: UnlockChip = restrictions.banking ? 'notAvailable' : bankChips[spec.key]
        return {
            id: `${spec.key}-bank`,
            labelKey: spec.key,
            icon: 'bank',
            chip,
            limitRefs: spec.limitRefs,
            flag: spec.flag,
            // active and unavailable rows are facts, not actions
            ...(chip === 'active' || chip === 'notAvailable' ? {} : { regionPath: spec.regionPath }),
        }
    }
    const rowsForGroup = (group: (typeof BANK_ROWS)[number]['group']) =>
        BANK_ROWS.filter((spec) => spec.group === group).map(bankRow)

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
    // The QR row keeps the Manteca offer chip when the user cannot pay yet.
    // Brazil leads because Pix is the bigger corridor of the two.
    const qrChip: UnlockChip = restrictions.banking ? 'notAvailable' : canPayQr ? 'active' : bankChips.brl
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
        // One row per currency, not per unlock (ruled 2026-09-21, hugo). Brazil
        // and Argentina still share one Manteca verification and the US and
        // Mexico one Bridge verification, so sibling rows route into the same
        // flow — but each states the truth about its OWN currency, which a
        // merged row could not. Mexico sits with the US, not in South America:
        // it rides Bridge, and LATAM would claim it for Manteca.
        {
            id: 'southAmerica',
            labelKey: 'southAmerica',
            isYourRegion: residences.has('BR') || residences.has('AR'),
            rows: rowsForGroup('southAmerica'),
        },
        {
            id: 'northAmerica',
            labelKey: 'northAmerica',
            isYourRegion: residences.has('US') || residences.has('MX'),
            rows: rowsForGroup('northAmerica'),
        },
        {
            id: 'europe',
            labelKey: 'europe',
            isYourRegion: isEuropeResidence,
            rows: rowsForGroup('europe'),
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
 * Scoped to the Bridge rows, which map 1:1 onto a VA product: `sepa` (EUR),
 * `usd` and `mxn`. Brazil/Argentina are deliberately left alone — the Manteca
 * Pix/QR rows are a distinct product from any Bridge BRL/ARS VA, not a
 * duplicate of it, so both may legitimately show at once.
 *
 * Known gap (2026-09-21): a dropped row takes its details drawer with it, and
 * the account surface it defers to does not state the Bridge per-transfer
 * caps. Those caps are still stated where they bind, in the add money and
 * withdraw flows (`useLimitsValidation`).
 */
export function dedupeHeldBankRows(
    rows: readonly UnlockRow[],
    activeAccountCurrencies: ReadonlySet<string>
): UnlockRow[] {
    return rows.filter((row) => {
        if (row.chip !== 'active') return true
        if (row.labelKey === 'sepa') return !activeAccountCurrencies.has('EUR')
        if (row.labelKey === 'usd') return !activeAccountCurrencies.has('USD')
        if (row.labelKey === 'mxn') return !activeAccountCurrencies.has('MXN')
        return true
    })
}
