/**
 * Group/row derivation for the Unlock payments screen (the Unlocked Regions
 * rework). Regions survive as presentational GROUPS; every ROW is a concrete
 * product with a live status chip. The unlock verb attaches to products
 * ("SEPA transfers · Unlock"), never to abstract regions, and the tap target
 * stays the existing region-intent KYC machinery.
 *
 * Pure: the view computes per-region chips from the capability model and
 * passes them in, so this stays unit-testable with plain values.
 */

export type UnlockChip = 'active' | 'alwaysOn' | 'unlock' | 'processing' | 'attention' | 'notAvailable'

/** Chip for a bank region before residence restrictions are applied. */
export type BankRegionChip = Exclude<UnlockChip, 'alwaysOn' | 'notAvailable'>

/** Exact key unions so next-intl's typed t() accepts the derived keys. */
export type UnlockRowLabelKey =
    | 'p2p'
    | 'card'
    | 'saBank'
    | 'pixBank'
    | 'pixQr'
    | 'arQrBank'
    | 'arQr'
    | 'brBank'
    | 'arBank'
    | 'naBank'
    | 'sepa'
export type UnlockGroupLabelKey = 'everywhere' | 'southAmerica' | 'northAmerica' | 'europe'

export interface UnlockRow {
    id: string
    /** i18n key under profile.unlockPayments.rows */
    labelKey: UnlockRowLabelKey
    icon: 'qr-code' | 'bank' | 'credit-card' | 'wallet'
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
    /** QR-only overlay: Bridge-verified users get AR/BR QR without Manteca bank rails */
    qrOnly: { brazil: boolean; argentina: boolean }
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

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { regionChips, qrOnly, restrictions, card, residenceIso2, secondResidenceIso2, isEuropeResidence } = input
    const residences = new Set([residenceIso2, secondResidenceIso2].filter(Boolean) as string[])

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

    const groups: UnlockGroup[] = [
        {
            id: 'everywhere',
            labelKey: 'everywhere',
            isYourRegion: false,
            rows: [{ id: 'p2p', labelKey: 'p2p', icon: 'wallet', chip: 'alwaysOn' }, cardRow],
        },
        // Brazil + Argentina share one Manteca verification (one unlock opens
        // both), so they present as a single South America group with ONE
        // merged row — separate country rows would imply two unlocks where
        // there is only one. Mexico is NOT here — it rides Bridge with the US
        // (LATAM would wrongly claim it). The row only splits per country for
        // the QR-only overlay, where the two countries genuinely differ
        // (Bridge-verified users hold AR/BR QR without the Manteca bank rails).
        {
            id: 'southAmerica',
            labelKey: 'southAmerica',
            isYourRegion: residences.has('BR') || residences.has('AR'),
            rows:
                (!qrOnly.brazil && !qrOnly.argentina) || regionChips.latam === 'active'
                    ? [bankRow('sa-bank', 'saBank', 'qr-code', 'latam', ['BRL', 'ARS'])]
                    : [
                          ...(qrOnly.brazil
                              ? [
                                    {
                                        id: 'pix-qr',
                                        labelKey: 'pixQr',
                                        icon: 'qr-code',
                                        chip: bankChip('active'),
                                        limitRefs: ['BRL'],
                                    } as UnlockRow,
                                    bankRow('br-bank', 'brBank', 'bank', 'latam', ['BRL']),
                                ]
                              : [bankRow('pix-bank', 'pixBank', 'qr-code', 'latam', ['BRL'])]),
                          ...(qrOnly.argentina
                              ? [
                                    {
                                        id: 'ar-qr',
                                        labelKey: 'arQr',
                                        icon: 'qr-code',
                                        chip: bankChip('active'),
                                        limitRefs: ['ARS'],
                                    } as UnlockRow,
                                    bankRow('ar-bank', 'arBank', 'bank', 'latam', ['ARS']),
                                ]
                              : [bankRow('ar-qr-bank', 'arQrBank', 'qr-code', 'latam', ['ARS'])]),
                      ],
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

    // Everywhere leads (the always-on layer is the first thing anyone sees),
    // then the user's own region, then the rest in catalog order.
    const [everywhere, ...rest] = groups
    rest.sort((a, b) => Number(b.isYourRegion) - Number(a.isYourRegion))
    return [everywhere, ...rest]
}
