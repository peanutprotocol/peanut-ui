import { formatIban } from '@/utils/general.utils'
import { isCryptoAddressType } from '@/utils/account-mask.utils'

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
    | 'senderReference'
    | 'paymentReference'
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
    | 'reference'
    | 'issuedOn'

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
    'paymentReference',
    'transferId',
    'senderReference',
    'depositInstructions',
    'points',
    'comment',
    'networkFee',
    'peanutFee',
    'attachment',
    'reference',
    'issuedOn',
]

/** the receipt's issuance timestamp — the moment the documented state was
 *  established, never the download time. status-branched: cancelled/closed
 *  receipts date from the cancellation, refunded from the refund, completed
 *  from settlement/claim, pending from creation. one rule shared by the
 *  details-card row and the pdf model so the two can never disagree. */
/**
 * The amount a receipt leads with, and the sign in front of it.
 *
 * A request pot states what it COLLECTED. Its `amount` is the goal it asked
 * for, which is not proof that any money arrived, and a pot never carries a
 * direction sign. Everything else states its own amount, signed the way the
 * history list signs it.
 *
 * The receipt screen and the PDF both derive from here. They used to disagree:
 * a $100 pot that collected $40 printed $100.00 on screen and $40.00 in the
 * PDF, and the PDF dropped the sign so a refund and a spend of the same value
 * printed the same headline.
 */
export const receiptHeadlineAmount = (
    transaction: { isRequestPotLink?: boolean; totalAmountCollected?: number | string | null },
    /** the amount the caller derived for a non-pot receipt */
    fallbackAmount: number,
    sign: '-' | '+' | ''
): { amount: number; sign: '-' | '+' | ''; isCollectedTotal: boolean } => {
    if (transaction.isRequestPotLink) {
        const collected = Number(transaction.totalAmountCollected)
        return { amount: Number.isFinite(collected) ? collected : 0, sign: '', isCollectedTotal: true }
    }
    return { amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0, sign, isCollectedTotal: false }
}

export const receiptIssuedAt = (transaction: {
    status?: string
    cancelledDate?: string | Date
    completedAt?: string | Date
    claimedAt?: string | Date
    createdAt?: string | Date
    date: string | Date
}): Date | undefined => {
    const { status } = transaction
    const source =
        status === 'cancelled'
            ? transaction.cancelledDate || transaction.createdAt || transaction.date
            : status === 'closed'
              ? transaction.cancelledDate || transaction.date || transaction.createdAt
              : status === 'refunded'
                ? transaction.date || transaction.completedAt || transaction.createdAt
                : status === 'completed'
                  ? transaction.claimedAt || transaction.completedAt || transaction.date || transaction.createdAt
                  : transaction.createdAt || transaction.date
    return source ? new Date(source) : undefined
}

/**
 * Whether the receipt's document-id row says anything the receipt does not
 * already say.
 *
 * The row prints the history-entry id. On a bank rail that same id already
 * prints as "Transfer ID", and on a crypto entry the id IS the transaction
 * hash, already printed as "Transaction ID". Both cases used to print the
 * value twice under two different names. Print the row only when the id
 * appears nowhere else. One rule for the screen and the pdf.
 */
export const showsReceiptReferenceRow = (transaction: {
    id?: string
    txHash?: string | null
    direction?: string
    status?: string
}): boolean => {
    if (!transaction.id) return false
    const showsTransferIdRow =
        (transaction.direction === 'bank_withdraw' || transaction.direction === 'bank_claim') &&
        transaction.status !== 'cancelled'
    if (showsTransferIdRow) return false
    // The ids are case-sensitive lookup keys; telling them apart is not.
    return !transaction.txHash || transaction.txHash.toLowerCase() !== transaction.id.toLowerCase()
}

/** Which label a bank-account row carries. Callers map it to display text —
 *  this module stays copy-free. */
export type BankAccountLabelKey = 'iban' | 'clabe' | 'accountNumber' | 'address'

/**
 * BE sends Prisma `AccountType` enum values like `BANK_IBAN` / `BANK_CLABE`
 * (not raw `'iban'`). Match by suffix so `BANK_IBAN` → `'iban'` without a
 * separate normalisation layer at every call site.
 */
export const bankAccountLabelKey = (type: string): BankAccountLabelKey => {
    const t = type.toLowerCase()
    if (isCryptoAddressType(type)) return 'address'
    if (t.endsWith('iban')) return 'iban'
    if (t.endsWith('clabe')) return 'clabe'
    return 'accountNumber'
}

/**
 * Copy target for the receipt's account-details row. Bank rails copy the
 * IBAN-formatted (uppercased, space-chunked) form; crypto destinations
 * (CRYPTO_WITHDRAW to Tron/Solana/EVM — wire `type` `'address'` /
 * `'evm-address'` / `'peanut-wallet'`) copy the address VERBATIM.
 * `formatIban` treats any string starting with two letters as an IBAN, and
 * every Tron address starts with 'T…', so it was uppercasing + chunking
 * case-sensitive base58 into an unusable address.
 */
export const getAccountCopyValue = (identifier: string, type: string) =>
    isCryptoAddressType(type) ? identifier : formatIban(identifier)

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
