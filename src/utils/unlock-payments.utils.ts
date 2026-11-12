/**
 * Group/row derivation for the Unlock payments screen (the Unlocked Regions
 * rework). Regions survive as presentational GROUPS; every ROW is a concrete
 * product with a live status chip. The unlock verb attaches to products
 * ("Euro bank transfers · Unlock"), never to abstract regions, and the tap target
 * stays the existing region-intent KYC machinery.
 *
 * Pure: the view reads each row's chip from the API's feature report and
 * passes it in, so this stays unit-testable with plain values.
 */

import { DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { mantecaWithdrawUrl } from '@/features/withdraw/routes'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'
import { QrKycState } from '@/constants/kyc.consts'
import type { FeatureReport } from '@/types/capabilities'

export type UnlockChip = 'active' | 'alwaysOn' | 'unlock' | 'processing' | 'attention' | 'notAvailable'

/** A bank row's chip, from its account's feature report entry. */
export type BankRegionChip = Exclude<UnlockChip, 'alwaysOn'>

/** Exact key unions so next-intl's typed t() accepts the derived keys. */
export type UnlockRowLabelKey =
    | 'p2p'
    | 'card'
    | 'crypto'
    | 'qrPay'
    | 'bankAccount'
    | 'brl'
    | 'ars'
    | 'usd'
    | 'mxn'
    | 'sepa'

/** The bank corridors, one per currency (2026-09-21). */
export type BankRowKey = Extract<UnlockRowLabelKey, 'brl' | 'ars' | 'usd' | 'mxn' | 'sepa'>
export type UnlockGroupLabelKey = 'everywhere' | 'spend' | 'southAmerica' | 'northAmerica' | 'europe'

export interface UnlockRow {
    id: string
    /** i18n key under profile.unlockPayments.rows */
    labelKey: UnlockRowLabelKey
    /** the product concept the row leads with; CONCEPT_ICONS holds its icon and color */
    concept: Extract<Concept, 'qrPay' | 'bank' | 'card' | 'peanutUser' | 'crypto'>
    chip: UnlockChip
    /** region path the tap routes into (existing region modal machinery); absent = not tappable */
    regionPath?: 'europe' | 'north-america' | 'latam'
    /** the card row, and a BRL row that sends to a Pix key: navigate instead of opening a region modal */
    href?: string
    /** the explainer line under the title, as a key under profile.unlockPayments */
    note?: 'qrPayNote' | 'qrPayArgentinaNote' | 'pixSendNote'
    /** the bank account row: the currencies it can hold, named under the title */
    currencies?: readonly string[]
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
    /**
     * The QR row: the countries it pays in, drawn as overlapping flags in
     * place of the concept bubble (TASK-23054, hugo).
     */
    flags?: readonly string[]
    /** bank rows: the ISO code the accounts page shows as the row title (2026-09-24) */
    currency?: string
    /**
     * a BRL row that leads with the Pix key send over the user's own bank rail
     * (`withPixSend`): that rail's status, which the row's drawer still shows
     * and opens
     */
    bankChip?: Exclude<BankRegionChip, 'active' | 'notAvailable'>
    /** bank rows: the deposit corridor the row adds money through */
    corridor?: DepositCorridor
    /**
     * why a `notAvailable` bank row is closed: the residence country, the
     * rail's own country rule, the provider not offering this one account
     * in the user's residence (the paperwork engine), or the BRL row's Pix
     * route refused for its own reason (`pix-route`: an outage, the rollout,
     * a pause), which the drawer words as the Pix pages do
     */
    unavailableBecause?: 'restricted-country' | 'residence' | 'account-residence' | 'pix-route'
}

/** The two lists beside the bank rows: the always-on Peanut rows and the spending methods. */
export interface UnlockGroup {
    id: Extract<UnlockGroupLabelKey, 'everywhere' | 'spend'>
    /** i18n key under profile.unlockPayments.groups */
    labelKey: Extract<UnlockGroupLabelKey, 'everywhere' | 'spend'>
    rows: UnlockRow[]
}

/** What the bank rows are derived from: the per-currency chips and the residence they are listed for. */
export interface BankRowsInput {
    /** Per currency, the API's answer for that account (`capabilities.features`). */
    bankChips: Record<BankRowKey, BankRegionChip>
    /** Per currency, which sentence explains a `notAvailable` row. */
    closedBecause: Partial<Record<BankRowKey, NonNullable<UnlockRow['unavailableBecause']>>>
    /** ISO-2 residence (verified preferred, else declared) for the "Your region" order */
    residenceIso2: string | null
    /** second declared residence (device mirror), so both regions sort first */
    secondResidenceIso2?: string | null
    /** whether the residence country is served by Bridge's Europe coverage */
    isEuropeResidence: boolean
}

export interface BuildUnlockGroupsInput {
    /** the QR-pay gate's answer (`selectQrKycGate`), the one /qr-pay and Home read too */
    qrPay: QrKycState
    card: UnlockChip | 'get'
    pixResidenceBlocked?: boolean
}

const CARD_ROW_BASE = { id: 'card', labelKey: 'card', concept: 'card' } as const

/**
 * The status of a row that pays through the QR rail (QR payments, the Pix key
 * send), from the QR-pay gate: the API's QR answer. Available only when a
 * payment would go through; a refusal the user can act on, or only support
 * can lift, reads Attention, never an Unlock that could only end in it.
 */
export function qrPayChip(qrPay: QrKycState): UnlockChip {
    switch (qrPay) {
        case QrKycState.PROCEED_TO_PAY:
            return 'active'
        case QrKycState.REGION_RESTRICTED:
        case QrKycState.PROVIDER_REJECTION_BLOCKED:
        case QrKycState.PROVIDER_RESTART_IDENTITY:
            return 'attention'
        case QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS:
        case QrKycState.PROVIDER_REJECTION_FIXABLE:
            return 'processing'
        default:
            return 'unlock'
    }
}

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
    const { bankChips, closedBecause, residenceIso2, secondResidenceIso2, isEuropeResidence } = input
    const residences = new Set([residenceIso2, secondResidenceIso2].filter(Boolean) as string[])
    const isOwnRegion: Record<(typeof BANK_ROWS)[number]['group'], boolean> = {
        southAmerica: residences.has('BR') || residences.has('AR'),
        northAmerica: residences.has('US') || residences.has('MX'),
        europe: isEuropeResidence,
    }

    const bankRow = (spec: (typeof BANK_ROWS)[number]): UnlockRow => {
        const chip = bankChips[spec.key]
        return {
            id: `${spec.key}-bank`,
            labelKey: spec.key,
            concept: 'bank',
            chip,
            limitRefs: spec.limitRefs,
            flag: DEPOSIT_RAILS[spec.corridor].flagIso2,
            currency: DEPOSIT_RAILS[spec.corridor].currency,
            corridor: spec.corridor,
            ...(chip === 'notAvailable' ? { unavailableBecause: closedBecause[spec.key] ?? 'restricted-country' } : {}),
            // active and unavailable rows are facts, not actions
            ...(chip === 'active' || chip === 'notAvailable' ? {} : { regionPath: spec.regionPath }),
        }
    }

    // `sort` is stable, so each region keeps its catalog order
    return [...BANK_ROWS].sort((a, b) => Number(isOwnRegion[b.group]) - Number(isOwnRegion[a.group])).map(bankRow)
}

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { qrPay, card } = input

    const cardChip: UnlockChip = card === 'get' ? 'unlock' : card
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
    // A Pix residence restriction leaves Mercado Pago QR available.
    const qrChip = qrPayChip(qrPay)
    const qrRow: UnlockRow = {
        id: 'qr-pay',
        labelKey: 'qrPay',
        concept: 'qrPay',
        chip: qrChip,
        note: input.pixResidenceBlocked ? 'qrPayArgentinaNote' : 'qrPayNote',
        flags: input.pixResidenceBlocked ? ['AR'] : ['BR', 'AR'],
        limitRefs: input.pixResidenceBlocked ? ['ARS'] : ['BRL', 'ARS'],
        ...(qrChip === 'active' ? {} : { regionPath: 'latam' as const }),
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
        // the card and QR payments both pay someone, and neither moves money
        // between a bank and Peanut. Sending to a Pix key has no row here: the
        // BRL row on Accounts carries it (`withPixSend`, TASK-23054).
        {
            id: 'spend',
            labelKey: 'spend',
            rows: [cardRow, qrRow],
        },
    ]
}

/** Where the one bank account row leads: the currency is picked on that screen. */
export const BANK_ACCOUNT_HREF = '/profile/accounts'

/**
 * Every bank currency as one row (Slava, 2026-10-27: "Bank account should be
 * one item, currency to select on the next step"). Its chip is the bank and
 * local features as the API states them (`useBankRows().accountChip`); it
 * names the currencies the user can still use.
 */
export function bankAccountRow(
    bankRows: readonly UnlockRow[],
    chip: UnlockChip,
    accounts: {
        features: FeatureReport
        heldCorridors?: readonly DepositCorridor[]
        openableCorridors?: readonly DepositCorridor[]
    }
): UnlockRow {
    const open = bankRows.filter((row) => row.chip !== 'notAvailable')
    let currencies = open.flatMap((row) => (row.currency ? [row.currency] : []))
    if (accounts) {
        const entries = { ...accounts.features.bank.accounts, ...accounts.features.local.accounts }
        const refused = (currency: string) => {
            const feature = currency === 'ARS' || currency === 'BRL' ? accounts.features.local : accounts.features.bank
            return (entries[currency] ?? feature).state === 'refused'
        }
        const known = new Set(Object.values(DEPOSIT_RAILS).map((rail) => rail.currency))
        for (const [currency, entry] of Object.entries(entries))
            if (known.has(currency) && entry.state !== 'refused') currencies.push(currency)
        for (const corridor of [...(accounts.heldCorridors ?? []), ...(accounts.openableCorridors ?? [])]) {
            const rail = DEPOSIT_RAILS[corridor]
            if (rail && isClaimable(rail)) currencies.push(rail.currency)
        }
        currencies = currencies.filter((currency) => !refused(currency))
    }
    return {
        id: 'bank-account',
        labelKey: 'bankAccount',
        concept: 'bank',
        chip,
        href: BANK_ACCOUNT_HREF,
        currencies: [...new Set(currencies)],
    }
}

export type PaymentMethodSection = 'active' | 'notActive' | 'unavailable'

/** Active methods first, then what the user can still set up or waits on, then what their residence closes. */
export function paymentMethodSections(rows: readonly UnlockRow[]): Record<PaymentMethodSection, UnlockRow[]> {
    const sections: Record<PaymentMethodSection, UnlockRow[]> = { active: [], notActive: [], unavailable: [] }
    for (const row of rows) {
        const section =
            row.chip === 'active' || row.chip === 'alwaysOn'
                ? 'active'
                : row.chip === 'notAvailable'
                  ? 'unavailable'
                  : 'notActive'
        sections[section].push(row)
    }
    return sections
}

export const PIX_SEND_HREF = mantecaWithdrawUrl({ method: 'pix', country: 'brazil' })

/** Pix sending and first-party BRL bank access have separate eligibility. */
export function withPixSend(
    rows: readonly UnlockRow[],
    pixSend: {
        /** the QR-pay gate's answer: the one /qr-pay gives */
        qrPay: QrKycState
        pixResidenceBlocked?: boolean
    }
): UnlockRow[] {
    if (pixSend.pixResidenceBlocked) return [...rows]
    const chip = qrPayChip(pixSend.qrPay)
    return rows.map((row) => {
        if (row.labelKey !== 'brl' || row.chip === 'active' || row.chip === 'alwaysOn') return row
        if (row.chip !== 'notAvailable') {
            return chip === 'active' ? { ...row, chip, note: 'pixSendNote', bankChip: row.chip } : row
        }
        const { unavailableBecause: _closed, ...open } = row
        return {
            ...open,
            chip,
            note: 'pixSendNote',
            ...(chip === 'active' ? { href: PIX_SEND_HREF } : { regionPath: 'latam' as const }),
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
