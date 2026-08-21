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

export type UnlockChip = 'active' | 'alwaysOn' | 'unlock' | 'processing' | 'oneMoreStep' | 'attention' | 'notAvailable'

/** Chip for a bank region before residence restrictions are applied. */
export type BankRegionChip = Exclude<UnlockChip, 'alwaysOn' | 'notAvailable'>

/** Exact key unions so next-intl's typed t() accepts the derived keys. */
export type UnlockRowLabelKey =
    | 'p2p'
    | 'card'
    | 'pixBank'
    | 'pixQr'
    | 'arQrBank'
    | 'arQr'
    | 'bank'
    | 'achWire'
    | 'spei'
    | 'sepa'
export type UnlockGroupLabelKey = 'everywhere' | 'brazil' | 'argentina' | 'unitedStates' | 'mexico' | 'europe'

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
    /** whether the residence country is served by Bridge's Europe coverage */
    isEuropeResidence: boolean
}

const CARD_ROW_BASE = { id: 'card', labelKey: 'card', icon: 'credit-card' } as const

export function buildUnlockGroups(input: BuildUnlockGroupsInput): UnlockGroup[] {
    const { regionChips, qrOnly, restrictions, card, residenceIso2, isEuropeResidence } = input

    const bankChip = (chip: BankRegionChip): UnlockChip => (restrictions.banking ? 'notAvailable' : chip)
    const bankRow = (
        id: string,
        labelKey: UnlockRowLabelKey,
        icon: UnlockRow['icon'],
        regionPath: NonNullable<UnlockRow['regionPath']>
    ): UnlockRow => {
        const chip = bankChip(regionChips[regionPath])
        return {
            id,
            labelKey,
            icon,
            chip,
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
        {
            id: 'brazil',
            labelKey: 'brazil',
            isYourRegion: residenceIso2 === 'BR',
            rows:
                qrOnly.brazil && regionChips.latam !== 'active'
                    ? [
                          { id: 'pix-qr', labelKey: 'pixQr', icon: 'qr-code', chip: bankChip('active') },
                          bankRow('br-bank', 'bank', 'bank', 'latam'),
                      ]
                    : [bankRow('pix-bank', 'pixBank', 'qr-code', 'latam')],
        },
        {
            id: 'argentina',
            labelKey: 'argentina',
            isYourRegion: residenceIso2 === 'AR',
            rows:
                qrOnly.argentina && regionChips.latam !== 'active'
                    ? [
                          { id: 'ar-qr', labelKey: 'arQr', icon: 'qr-code', chip: bankChip('active') },
                          bankRow('ar-bank', 'bank', 'bank', 'latam'),
                      ]
                    : [bankRow('ar-qr-bank', 'arQrBank', 'qr-code', 'latam')],
        },
        {
            id: 'unitedStates',
            labelKey: 'unitedStates',
            isYourRegion: residenceIso2 === 'US',
            rows: [bankRow('ach-wire', 'achWire', 'bank', 'north-america')],
        },
        {
            id: 'mexico',
            labelKey: 'mexico',
            isYourRegion: residenceIso2 === 'MX',
            rows: [bankRow('spei', 'spei', 'bank', 'north-america')],
        },
        {
            id: 'europe',
            labelKey: 'europe',
            isYourRegion: isEuropeResidence,
            rows: [bankRow('sepa', 'sepa', 'bank', 'europe')],
        },
    ]

    // Everywhere leads (the always-on layer is the first thing anyone sees),
    // then the user's own region, then the rest in catalog order.
    const [everywhere, ...rest] = groups
    rest.sort((a, b) => Number(b.isYourRegion) - Number(a.isYourRegion))
    return [everywhere, ...rest]
}
