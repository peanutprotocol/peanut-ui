import { isIntentKind, type IntentKind } from '@/components/TransactionDetails/strategies/registry'
import { type IconStatusType } from '@/components/Global/Badges/Badge'

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
    // `intentKind` is an open string on the wire. A kind this client has no
    // strategy for — one the backend added after this build — is not a kind:
    // casting it through sent the receipt route a value it cannot resolve.
    if (isIntentKind(charge.intentKind)) return charge.intentKind
    // The API's own default for a kind it has no type for is DIRECT_SEND.
    return RECEIPT_KIND_BY_CHARGE_TYPE[charge.transactionType ?? ''] ?? 'DIRECT_TRANSFER'
}

const RECEIPT_STATUS_BY_CHARGE_STATUS: Record<string, IconStatusType> = {
    PENDING: 'pending',
    AWAITING_USER_ACTION: 'pending',
    AWAITING_SETTLEMENT: 'processing',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
}

/**
 * The receipt status a charge read back from the API states.
 *
 * Only for a charge read after its payment: the charge a flow holds from
 * creation still says PENDING after the money moved. Undefined on an API that
 * does not send the charge status yet.
 */
export function receiptStatusForCharge(charge: { status?: string | null } | null | undefined) {
    return charge?.status ? RECEIPT_STATUS_BY_CHARGE_STATUS[charge.status] : undefined
}
