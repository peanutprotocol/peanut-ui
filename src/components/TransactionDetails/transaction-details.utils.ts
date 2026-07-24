// union type for all possible rows in the receipt
export type TransactionDetailsRowKey =
    | 'createdAt'
    | 'claimed'
    | 'to'
    | 'tokenAndNetwork'
    | 'txId'
    | 'cancelled'
    | 'completed'
    | 'refunded'
    | 'exchangeRate'
    | 'bankAccountDetails'
    | 'transferId'
    | 'depositInstructions'
    | 'networkFee'
    | 'fee'
    | 'peanutFee'
    | 'points'
    | 'comment'
    | 'attachment'
    | 'mantecaDepositInfo'
    | 'cardPayment'
    | 'closed'

// order of the rows in the receipt (must match actual rendering order in component)
export const transactionDetailsRowKeys: TransactionDetailsRowKey[] = [
    'createdAt',
    'cancelled',
    'claimed',
    'completed',
    'refunded',
    'closed',
    'to',
    'tokenAndNetwork',
    'txId',
    'cardPayment',
    'fee',
    'mantecaDepositInfo',
    'exchangeRate',
    'bankAccountDetails',
    'transferId',
    'depositInstructions',
    'points',
    'comment',
    'networkFee',
    'peanutFee',
    'attachment',
]

/**
 * BE sends Prisma `AccountType` enum values like `BANK_IBAN` / `BANK_CLABE`
 * (not raw `'iban'`). Match by suffix so `BANK_IBAN` → "IBAN" without a
 * separate normalisation layer at every call site.
 */
export const getBankAccountLabel = (type: string) => {
    const t = type.toLowerCase()
    if (t.endsWith('iban')) return 'IBAN'
    if (t.endsWith('clabe')) return 'CLABE'
    return 'Account Number'
}

/**
 * Recover a 2-letter ISO country code from a Rain merchant-country value.
 * Rain populates the field as ISO-2 in nominal data, but legacy intents and
 * edge merchants sometimes ship it joined with the city ("San Francisco, US")
 * or in whitespace-padded form. Returns the lowercased 2-letter tail when one
 * is recoverable, null otherwise. Shared by CardPaymentRows (location flag)
 * and LocalRailNudge (country → local-rail nudge).
 */
export function extractMerchantIso2(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const tail = trimmed.split(/[\s,]+/).pop() ?? ''
    return /^[a-z]{2}$/i.test(tail) ? tail.toLowerCase() : null
}

/** Rain often returns merchant names ALL-CAPS when its enrichment pipeline
 *  doesn't recognize the brand ("BOYACA", "ANTHROPIC"). When that happens,
 *  display them in Title Case for readability — but only when the name is
 *  long enough that title-casing won't garble a real acronym (KFC, IBM,
 *  BBC stay as-is). Mixed-case names are returned unchanged so enriched
 *  brand names like "iPhone Store" or "Acme Coffee" aren't mangled. Shared
 *  by every card/QR strategy that surfaces a merchant name. */
const ACRONYM_LENGTH_THRESHOLD = 4
export function normalizeMerchantName(raw: string): string {
    if (raw !== raw.toUpperCase()) return raw
    if (raw.length <= ACRONYM_LENGTH_THRESHOLD) return raw
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Parse a wire amount defensively. BE amounts are plain decimal strings
 *  ("14.68"), but strip currency formatting before parsing — `Number('-1,468')`
 *  is NaN. Single source of the parse rule for the TransactionDetails module
 *  (list-row refund detection AND the transformer's usdAmount), so the two
 *  can never read the same wire amount differently. */
export function parseWireAmount(amount: string | number | null | undefined): number {
    if (amount === null || amount === undefined) return NaN
    return parseFloat(String(amount).replace(/[^\d.-]/g, ''))
}

/** Refund detection off the wire amount — NaN never routes to refund. Used
 *  by the cardSpend strategy's negative-auth detection. */
export function isNegativeWireAmount(amount: string | number | null | undefined): boolean {
    const n = parseWireAmount(amount)
    return Number.isFinite(n) && n < 0
}

/** Parse a cents amount and reject NaN / Infinity / null up-front so the
 *  drawer never renders "Charged in NaN EUR". Shared by CardPaymentRows
 *  (breakdown math) and CardAdjustmentNotice (over-capture gate) so both
 *  read Rain's auth/settled cents identically. */
export function parseCents(value: string | null | undefined): number | null {
    if (value == null) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}
