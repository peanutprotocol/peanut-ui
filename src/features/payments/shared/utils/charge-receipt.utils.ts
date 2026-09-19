import { type IntentKind } from '@/components/TransactionDetails/strategies/registry'

/**
 * The history kind under which a charge's receipt resolves.
 *
 * GET /history/:entryId looks a receipt up by `transaction_intents.id` (the
 * charge uuid) AND the intent's kind, so a wrong kind 404s even with the right
 * id.
 *
 * The charge response states the kind itself as `intentKind`, and that wins.
 * `transactionType` cannot be inverted safely: the API derives it from the
 * kind and folds several kinds into one type — a P2P_SEND made before 2026-04
 * reads as DIRECT_SEND, and so does any kind the API has no type for. The table
 * is the fallback for an API deployed before `intentKind`.
 */
const RECEIPT_KIND_BY_CHARGE_TYPE: Record<string, IntentKind> = {
    DIRECT_SEND: 'DIRECT_TRANSFER',
    REQUEST: 'P2P_REQUEST_FULFILL',
    WITHDRAW: 'CRYPTO_WITHDRAW',
    DEPOSIT: 'CRYPTO_DEPOSIT',
    SEND_LINK: 'SEND_LINK',
}

export function receiptKindForCharge(charge: {
    transactionType?: string | null
    intentKind?: string | null
}): IntentKind {
    if (charge.intentKind) return charge.intentKind as IntentKind
    // The API's own default for a kind it has no type for is DIRECT_SEND.
    return RECEIPT_KIND_BY_CHARGE_TYPE[charge.transactionType ?? ''] ?? 'DIRECT_TRANSFER'
}
