/**
 * Catalog keys (under the `transaction` namespace) for the FE-generated
 * counterparty labels the transformer/strategies emit when the row has no real
 * counterparty name ('Card payment', 'Bank Account', reaper-fail copy, …).
 *
 * The transformer keeps emitting the English string in `userName` (data
 * fallback + initials), and additionally sets `nameKey`/`nameParams` so render
 * sites can show localized copy: `nameKey ? t(nameKey, nameParams) : userName`.
 * Same enum→key approach as TYPE_LABEL_KEYS / STATUS_LABEL_KEYS — never match
 * on the English prose itself.
 */

export const TRANSACTION_NAME_KEYS = {
    merchant: 'name.merchant',
    cardPayment: 'name.cardPayment',
    cardRefund: 'name.cardRefund',
    refundFrom: 'name.refundFrom',
    refund: 'name.refund',
    depositSource: 'name.depositSource',
    externalWallet: 'name.externalWallet',
    externalAccount: 'name.externalAccount',
    claimedToBank: 'name.claimedToBank',
    bankAccount: 'name.bankAccount',
    recipient: 'name.recipient',
    sender: 'name.sender',
    request: 'name.request',
    peanutReward: 'name.peanutReward',
    receivedViaLink: 'name.receivedViaLink',
    sentViaLink: 'name.sentViaLink',
    transaction: 'name.transaction',
    failedQrPayment: 'name.failedQrPayment',
} as const

/**
 * Reaper-failed rows: `entry.extraData.failReason` (the BE's stable
 * `${kind}_timeout` discriminant) → catalog key. Unknown reasons collapse onto
 * {@link REAPER_FAIL_FALLBACK_KEY} — a raw key path must never render.
 */
export const REAPER_FAIL_KEYS = {
    p2p_send_timeout: 'failReason.p2pSendTimeout',
    p2p_request_fulfill_timeout: 'failReason.p2pRequestFulfillTimeout',
    send_link_timeout: 'failReason.sendLinkTimeout',
    send_link_claim_timeout: 'failReason.sendLinkClaimTimeout',
    crypto_withdraw_timeout: 'failReason.cryptoWithdrawTimeout',
    qr_pay_timeout: 'failReason.qrPayTimeout',
    onramp_timeout: 'failReason.onrampTimeout',
    offramp_timeout: 'failReason.offrampTimeout',
    refund_timeout: 'failReason.refundTimeout',
} as const

export const REAPER_FAIL_FALLBACK_KEY = 'failReason.generic' as const

export const reaperFailKey = (failReason: string): ReaperFailKey =>
    failReason in REAPER_FAIL_KEYS
        ? REAPER_FAIL_KEYS[failReason as keyof typeof REAPER_FAIL_KEYS]
        : REAPER_FAIL_FALLBACK_KEY

type ReaperFailKey = (typeof REAPER_FAIL_KEYS)[keyof typeof REAPER_FAIL_KEYS] | typeof REAPER_FAIL_FALLBACK_KEY

export type TransactionNameKey = (typeof TRANSACTION_NAME_KEYS)[keyof typeof TRANSACTION_NAME_KEYS] | ReaperFailKey

/**
 * Labels that are complete on their own — the receipt title renders them
 * bare instead of interpolating them into direction wording. Without this
 * escape getTitle produced compounds like "Sending to Send didn't complete"
 * (reaper fail copy) and "Received from Refund from Starbucks" (refunds).
 * `name.request` is here so an unresolved open request reads "Request", not
 * "Request is requesting".
 */
export const SELF_DESCRIBING_NAME_KEYS: ReadonlySet<TransactionNameKey> = new Set<TransactionNameKey>([
    ...Object.values(REAPER_FAIL_KEYS),
    REAPER_FAIL_FALLBACK_KEY,
    TRANSACTION_NAME_KEYS.failedQrPayment,
    TRANSACTION_NAME_KEYS.refundFrom,
    TRANSACTION_NAME_KEYS.cardRefund,
    TRANSACTION_NAME_KEYS.refund,
    TRANSACTION_NAME_KEYS.request,
])

type TransactionTranslator = ReturnType<typeof import('next-intl').useTranslations<'transaction'>>

/** Localize an FE-generated transaction label; ICU params carry the data bits. */
export function translateTransactionName(
    t: TransactionTranslator,
    nameKey: TransactionNameKey,
    nameParams?: Record<string, string>
): string {
    return nameParams ? t(nameKey, nameParams) : t(nameKey)
}
