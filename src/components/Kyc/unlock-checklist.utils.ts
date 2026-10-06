import { KYC_INTENT_KEYS, type KycIntentKey, type KycIntentsConfig, type KycIntentSet } from '@/services/kyc-intents'

/**
 * Closed reasons the checklist shows on the row, because the person can
 * change them: another document, a tax ID, a birthday. Every other reason is
 * about the residence (geo-blocked, uk_resident_blocked,
 * residence_bank_restricted, local_residence_unsupported,
 * us_state_unsupported, residence_sanctioned, residence_unknown), and a
 * feature a residence never has is not offered at all: hidden, not greyed.
 * Each code here has a line in the identity.reasons catalog.
 */
export const SHOWN_CLOSED_REASONS: ReadonlySet<string> = new Set([
    'document_country_unsupported',
    'local_tax_id_missing',
    'manteca_us_nationality_restricted',
    'under_minimum_age',
])

// the residences with their own ID and QR wording; every other one reads the generic line
const NAMED_RESIDENCES: readonly string[] = ['AR', 'BR']
/** Which copy a residence reads: its own lines for AR and BR, the generic line elsewhere. */
export const residenceCopyVariant = (residence: string): 'AR' | 'BR' | 'default' =>
    NAMED_RESIDENCES.includes(residence) ? (residence as 'AR' | 'BR') : 'default'

export interface UnlockRow {
    key: KycIntentKey
    available: boolean
    /** Only on a closed row the user can still change. */
    reason?: string
}

/** The rows in display order: open rows first, closed rows the user can act on last. */
export function unlockRows(config: KycIntentsConfig): UnlockRow[] {
    const rows = KYC_INTENT_KEYS.flatMap((key): UnlockRow[] => {
        const intent = config.intents[key]
        if (!intent) return []
        if (intent.available) return [{ key, available: true }]
        if (intent.reason && SHOWN_CLOSED_REASONS.has(intent.reason)) {
            return [{ key, available: false, reason: intent.reason }]
        }
        return []
    })
    return [...rows.filter((row) => row.available), ...rows.filter((row) => !row.available)]
}

/** Every open row ticked: the selection each new answer starts from. */
export function defaultIntentSet(rows: UnlockRow[]): KycIntentSet {
    return Object.fromEntries(
        KYC_INTENT_KEYS.map((key) => [key, rows.some((row) => row.key === key && row.available)])
    ) as KycIntentSet
}

/** "Unlock QR payments" when QR is the only feature the user can tick. */
export function isQrOnly(rows: UnlockRow[]): boolean {
    const open = rows.filter((row) => row.available)
    return open.length === 1 && open[0].key === 'qr'
}
