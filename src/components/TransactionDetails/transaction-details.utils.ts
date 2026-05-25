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
