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

import { DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import { gatingResidenceIso2s, residenceAllows } from '@/features/deposit-accounts/residenceGate'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { mantecaWithdrawUrl } from '@/features/withdraw/routes'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'

export type UnlockChip = 'active' | 'alwaysOn' | 'unlock' | 'processing' | 'attention' | 'notAvailable'

/** Chip for a bank region before residence restrictions are applied. */
export type BankRegionChip = Exclude<UnlockChip, 'alwaysOn' | 'notAvailable'>

/** Exact key unions so next-intl's typed t() accepts the derived keys. */
export type UnlockRowLabelKey = 'p2p' | 'card' | 'crypto' | 'qrPay' | 'pixKey' | 'brl' | 'ars' | 'usd' | 'mxn' | 'sepa'

/** The bank corridors, one per currency (2026-09-21). */
export type BankRowKey = Extract<UnlockRowLabelKey, 'brl' | 'ars' | 'usd' | 'mxn' | 'sepa'>
export type UnlockGroupLabelKey = 'everywhere' | 'spend' | 'southAmerica' | 'northAmerica' | 'europe'

export interface UnlockRow {
    id: string
    /** i18n key under profile.unlockPayments.rows */
    labelKey: UnlockRowLabelKey
    /** the product concept the row leads with; CONCEPT_ICONS holds its icon and color */
    concept: Extract<Concept, 'qrPay' | 'pixKey' | 'bank' | 'card' | 'peanutUser' | 'crypto'>
    chip: UnlockChip
    /** region path the tap routes into (existing region modal machinery); absent = not tappable */
    regionPath?: 'europe' | 'north-america' | 'latam'
    /** card and Pix-key rows: navigate instead of opening a region modal */
    href?: string
    /** the explainer line under the title, as a key under profile.unlockPayments */
    note?: 'qrPayNote' | 'pixKeyNote' | 'pixSendNote'
    /**
     * Which limits apply once the row is active: Manteca per-currency
     * allowances (BRL/ARS) and/or the shared Bridge per-transaction cap.
     */
    limitRefs?: readonly ('BRL' | 'ARS' | 'bridge')[]
    /**
     * Currency-first accounts list (2026-09-18): the flag that replaces the
     * concept bubble as this row's leading glyph. One per row, and
     * since 2026-09-21 one country per row, so it is simply that country's.
     * Absent on `p2p`/`card`, which keep their icons in the "Peanut" group.
     */
    flag?: string
    /** bank rows: the ISO code the accounts page shows as the row title (2026-09-24) */
    currency?: string
    /** bank rows: the deposit corridor the row adds money through */
    corridor?: DepositCorridor
    /** why a `notAvailable` bank row is closed: the residence country, or the rail's own country rule */
    unavailableBecause?: 'restricted-country' | 'residence'
}

/** The two lists beside the bank rows: the always-on Peanut rows and the spending methods. */
export interface UnlockGroup {
    id: Extract<UnlockGroupLabelKey, 'everywhere' | 'spend'>
    /** i18n key under profile.unlockPayments.groups */
    labelKey: Extract<UnlockGroupLabelKey, 'everywhere' | 'spend'>
    rows: UnlockRow[]
}

/** What the bank rows are derived from: the per-currency chips, the restrictions and the residence. */
export interface BankRowsInput {
    /**
     * Pre-restriction chip per bank corridor, one per currency. The view
     * derives each from the rails of that corridor's OWN country, so a chip
     * can never claim a currency the user cannot move.
     */
    bankChips: Record<BankRowKey, BankRegionChip>
    restrictions: { banking: boolean; card: boolean }
    /** ISO-2 residence (verified preferred, else declared) for the "Your region" order */
    residenceIso2: string | null
    /** second declared residence (device mirror), so both regions sort first */
    secondResidenceIso2?: string | null
    /** whether the residence country is served by Bridge's Europe coverage */
    isEuropeResidence: boolean
}

export interface BuildUnlockGroupsInput extends Pick<BankRowsInput, 'bankChips' | 'restrictions'> {
    /** whether the user can pay by QR in Brazil or Argentina today (the `pay` capability) */
    canPayQr: boolean
    /**
     * whether the user holds the Manteca `pay` capability itself — the exact
     * gate /qr-pay enforces. Narrower than `canPayQr`, which also counts the
     * legacy Bridge-only QR cohort that /qr-pay would send back to verification.
     */
    canPayPixKey: boolean
    card: 'active' | 'get' | 'notAvailable'
}

const CARD_ROW_BASE = { id: 'card', labelKey: 'card', concept: 'card' } as const

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
    regionPath: NonNullable<UnlockRow['regionPath']>
    limitRefs: NonNullable<UnlockRow['limitRefs']>
    /**
     * The deposit corridor the row adds money through. It carries the
     * residence rule where there is one: the Argentine account opens to a
     * legal resident alone, and the Brazilian one needs a CPF, pre-checked
     * through a Brazilian residence (`residenceGate`, client-side). Those rows
     * are not an offer to anyone else. The row's currency and flag are the
     * corridor's own (`DEPOSIT_RAILS`).
     */
    corridor: DepositCorridor
}[] = [
    {
        key: 'brl',
        group: 'southAmerica',
        country: 'BR',
        regionPath: 'latam',
        limitRefs: ['BRL'],
        corridor: 'PIX_BR',
    },
    {
        key: 'ars',
        group: 'southAmerica',
        country: 'AR',
        regionPath: 'latam',
        limitRefs: ['ARS'],
        corridor: 'BANK_TRANSFER_AR',
    },
    {
        key: 'usd',
        group: 'northAmerica',
        country: 'US',
        regionPath: 'north-america',
        limitRefs: ['bridge'],
        corridor: 'ACH_US',
    },
    {
        key: 'mxn',
        group: 'northAmerica',
        country: 'MX',
        regionPath: 'north-america',
        limitRefs: ['bridge'],
        corridor: 'SPEI_MX',
    },
    {
        key: 'sepa',
        group: 'europe',
        country: 'EU',
        regionPath: 'europe',
        limitRefs: ['bridge'],
        corridor: 'SEPA_EU',
    },
]

/** The rail jurisdiction each bank row reads its chip from. */
export const BANK_ROW_COUNTRIES: Record<BankRowKey, string> = Object.fromEntries(
    BANK_ROWS.map((row) => [row.key, row.country])
) as Record<BankRowKey, string>

/**
 * The bank rows, one per currency, in the order both money screens list them:
 * the user's own region first, the rest in catalog order.
 *
 * One row per currency, not per unlock (ruled 2026-09-21, hugo). Brazil and
 * Argentina still share one Manteca verification and the US and Mexico one
 * Bridge verification, so sibling rows route into the same flow — but each
 * states the truth about its OWN currency, which a merged row could not.
 * Mexico sits with the US, not in South America: it rides Bridge, and LATAM
 * would claim it for Manteca.
 */
export function buildBankRows(input: BankRowsInput): UnlockRow[] {
    const { bankChips, restrictions, residenceIso2, secondResidenceIso2, isEuropeResidence } = input
    const residences = new Set([residenceIso2, secondResidenceIso2].filter(Boolean) as string[])
    // `residenceIso2` is already verified-else-declared; the same derivation
    // the top-up gates read (`useResidenceIso2s`), so the row and the flow
    // behind it can never disagree about who lives where.
    const gatingResidences = gatingResidenceIso2s({ verified: residenceIso2, second: secondResidenceIso2 })
    const isOwnRegion: Record<(typeof BANK_ROWS)[number]['group'], boolean> = {
        southAmerica: residences.has('BR') || residences.has('AR'),
        northAmerica: residences.has('US') || residences.has('MX'),
        europe: isEuropeResidence,
    }

    const bankRow = (spec: (typeof BANK_ROWS)[number]): UnlockRow => {
        const railChip = bankChips[spec.key]
        // A residence-gated corridor is not offered outside its country: the
        // account behind it is for residents, so an Unlock here could only end
        // in a refusal — and a Processing chip would narrate a rail the user
        // can never finish. Fails closed on an unknown residence;
        // the residence row above is the way to state one. A rail that already
        // works stays a fact: the user opened it while they lived there.
        const residenceGated = railChip !== 'active' && !residenceAllows(spec.corridor, gatingResidences)
        const chip: UnlockChip = restrictions.banking || residenceGated ? 'notAvailable' : railChip
        return {
            id: `${spec.key}-bank`,
            labelKey: spec.key,
            concept: 'bank',
            chip,
            limitRefs: spec.limitRefs,
            flag: DEPOSIT_RAILS[spec.corridor].flagIso2,
            currency: DEPOSIT_RAILS[spec.corridor].currency,
            corridor: spec.corridor,
            ...(chip === 'notAvailable'
                ? {
                      unavailableBecause: restrictions.banking
                          ? ('restricted-country' as const)
                          : ('residence' as const),
                  }
                : {}),
            // active and unavailable rows are facts, not actions
            ...(chip === 'active' || chip === 'notAvailable' ? {} : { regionPath: spec.regionPath }),
        }
    }

    // `sort` is stable, so each region keeps its catalog order
    return [...BANK_ROWS].sort((a, b) => Number(isOwnRegion[b.group]) - Number(isOwnRegion[a.group])).map(bankRow)
}

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { bankChips, canPayQr, canPayPixKey, restrictions, card } = input

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
        concept: 'qrPay',
        chip: qrChip,
        note: 'qrPayNote',
        limitRefs: ['BRL', 'ARS'],
        ...(qrChip === 'active' || qrChip === 'notAvailable' ? {} : { regionPath: 'latam' as const }),
    }
    // Paying a Pix key rides the QR-payment rail (the method=pix delegation
    // in /withdraw/manteca hands off to /qr-pay). Its own row exists because
    // users read "QR payments" as scan-only and paid Pix keys elsewhere
    // (2026-09-23, hugo). It reads Available only on the Manteca pay
    // capability /qr-pay checks, never on the QR row's legacy Bridge-only
    // fallback: that cohort would reach key entry and then be sent back to
    // verification. Everyone else gets the LATAM unlock offer.
    const pixKeyOfferChip: UnlockChip = bankChips.brl === 'active' ? 'unlock' : bankChips.brl
    const pixKeyChip: UnlockChip = restrictions.banking ? 'notAvailable' : canPayPixKey ? 'active' : pixKeyOfferChip
    const pixKeyRow: UnlockRow = {
        id: 'pix-key',
        labelKey: 'pixKey',
        concept: 'pixKey',
        chip: pixKeyChip,
        note: 'pixKeyNote',
        ...(pixKeyChip === 'active'
            ? { href: mantecaWithdrawUrl({ method: 'pix', country: 'brazil' }) }
            : pixKeyChip === 'notAvailable'
              ? {}
              : { regionPath: 'latam' as const }),
    }

    // The always-on layer and the spending methods. The bank rows are their
    // own list (`buildBankRows`), shared with Add money.
    return [
        {
            id: 'everywhere',
            labelKey: 'everywhere',
            rows: [
                { id: 'p2p', labelKey: 'p2p', concept: 'peanutUser', chip: 'alwaysOn' },
                // On-chain, no KYC and no Peanut unlock gates it — same
                // always-on layer as P2P (regression fix, ui#3271 QA pass 2:
                // the currency-first merge dropped this row entirely).
                { id: 'crypto', labelKey: 'crypto', concept: 'crypto', chip: 'alwaysOn' },
            ],
        },
        // Spending, named apart from adding and withdrawing money (2026-09-21):
        // the card, QR payments and Pix keys all pay someone, and none moves
        // money between a bank and Peanut.
        {
            id: 'spend',
            labelKey: 'spend',
            rows: [cardRow, qrRow, pixKeyRow],
        },
    ]
}

/**
 * The bank rows as Accounts and payments lists them: a BRL row closed only by
 * residence speaks for sending to a Pix key instead.
 *
 * Adding reais by Pix is for Brazilian residents, but every verified user can
 * send to any Pix key (hugo, 2026-09-24, QA-12) — the one way BRL leaves
 * Peanut. So outside Brazil the row carries the Pix key row's status and tap
 * target, with a note that says it is for sending. Add money keeps the closed
 * row: adding is the only thing that screen offers.
 */
export function withPixSend(rows: readonly UnlockRow[], pixKeyRow: UnlockRow | undefined): UnlockRow[] {
    return rows.map((row) => {
        if (!pixKeyRow || row.labelKey !== 'brl' || row.unavailableBecause !== 'residence') return row
        const { unavailableBecause: _closed, regionPath: _region, ...open } = row
        return {
            ...open,
            chip: pixKeyRow.chip,
            note: 'pixSendNote',
            ...(pixKeyRow.href ? { href: pixKeyRow.href } : {}),
            ...(pixKeyRow.regionPath ? { regionPath: pixKeyRow.regionPath } : {}),
        }
    })
}

/**
 * The bank rows that survive once a virtual account already covers the same
 * currency.
 *
 * A row goes only when nothing is lost with it: the account is ACTIVE and the
 * row's own chip is `active`. A revoked or provisioning account does not cover
 * the corridor, and a row with any other chip is the user's only way into the
 * fix or rejection modal for that rail.
 *
 * Scoped to rows whose corridor is itself a virtual-account product (EUR, USD,
 * MXN). Brazil/Argentina are deliberately left alone — their one-off Manteca
 * transfers are a distinct product from any virtual account in the same
 * currency, so both may legitimately show at once.
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
    return rows.filter(
        (row) =>
            row.chip !== 'active' ||
            !row.corridor ||
            !isClaimable(DEPOSIT_RAILS[row.corridor]) ||
            !activeAccountCurrencies.has(DEPOSIT_RAILS[row.corridor].currency)
    )
}
