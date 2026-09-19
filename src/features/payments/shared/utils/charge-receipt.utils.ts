import { type IntentKind } from '@/components/TransactionDetails/strategies/registry'
import { type TChargeTransactionType } from '@/services/services.types'

/**
 * The history kind under which a charge's receipt resolves.
 *
 * GET /history/:entryId looks a receipt up by `transaction_intents.id` (the
 * charge uuid) AND the intent's kind, so a wrong kind 404s even with the right
 * id. The charge response derives `transactionType` from that same intent kind
 * (peanut-api-ts `intentKindToTransactionType`); this is its inverse.
 */
const RECEIPT_KIND_BY_CHARGE_TYPE: Record<TChargeTransactionType, IntentKind> = {
    DIRECT_SEND: 'DIRECT_TRANSFER',
    REQUEST: 'P2P_REQUEST_FULFILL',
    WITHDRAW: 'CRYPTO_WITHDRAW',
    DEPOSIT: 'CRYPTO_DEPOSIT',
}

export function receiptKindForCharge(transactionType: TChargeTransactionType): IntentKind {
    return RECEIPT_KIND_BY_CHARGE_TYPE[transactionType]
}
