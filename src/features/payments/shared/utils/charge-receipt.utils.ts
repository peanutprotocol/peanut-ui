import { isIntentKind, type IntentKind } from '@/components/TransactionDetails/strategies/registry'
import { type IconStatusType } from '@/components/Global/Badges/Badge'
import {
    mapTransactionDataForDrawer,
    type TransactionDetails,
} from '@/components/TransactionDetails/transactionTransformer'
import { type HistoryEntry } from '@/utils/history.utils'

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

/** How a charge read back after an external-wallet deposit ended up. */
export type ChargeReadOutcome = 'completed' | 'failed' | 'timeout' | 'unknown' | 'cancelled'

/**
 * Reads a charge until the API has booked the payment into it.
 *
 * Rhino's deposit status turns "completed" on BRIDGE_EXECUTED. The API books
 * the payment after that (webhook, payment, validator), a few seconds later,
 * so a single read usually finds the charge still PENDING or PROCESSING with
 * nothing settled (TASK-23856). This reads every `intervalMs` until the charge
 * is COMPLETED, FAILED or CANCELLED, or `timeoutMs` passes.
 *
 * - `unknown`: the API sends no charge status yet, so there is nothing to wait for.
 * - `cancelled`: `isCancelled` turned true (the payer left the screen); the
 *   caller must not act on the result.
 *
 * `settledBefore` is the charge's settled amount before this payment, for a
 * top-up on a charge that already completed short. Rhino reports the transfer
 * before the API books it, so a COMPLETED read whose settled amount has not
 * moved is not final yet: the read goes on until it moves or the deadline
 * passes.
 *
 * A failed read is retried until the deadline; `charge` is the last read that
 * succeeded, or null.
 */
export async function readChargeUntilFinal<T extends { status?: string | null; settledAmount?: string | null }>(
    read: () => Promise<T>,
    {
        intervalMs = 3_000,
        timeoutMs = 60_000,
        isCancelled = () => false,
        settledBefore,
    }: { intervalMs?: number; timeoutMs?: number; isCancelled?: () => boolean; settledBefore?: string | null } = {}
): Promise<{ charge: T | null; outcome: ChargeReadOutcome }> {
    const deadline = Date.now() + timeoutMs
    let charge: T | null = null
    for (;;) {
        if (isCancelled()) return { charge, outcome: 'cancelled' }
        try {
            charge = await read()
        } catch {
            // keep the last good read; the next attempt may succeed
        }
        if (isCancelled()) return { charge, outcome: 'cancelled' }
        if (charge && !charge.status) return { charge, outcome: 'unknown' }
        if (charge?.status === 'COMPLETED' && !(settledBefore != null && charge.settledAmount === settledBefore))
            return { charge, outcome: 'completed' }
        if (charge?.status === 'FAILED' || charge?.status === 'CANCELLED') return { charge, outcome: 'failed' }
        if (Date.now() + intervalMs > deadline) return { charge, outcome: 'timeout' }
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
}

/**
 * A charge the API has not booked yet, or one whose booking cannot be told:
 * the external-wallet read-back gave up while it was still PENDING or
 * PROCESSING, or the API sends no charge status at all (a build before
 * api#1907). A deposit under the bridge minimum never leaves PENDING, so a
 * payer who sent too little lands here too. The success screen then claims
 * no amount.
 */
export function isChargeAwaitingBooking(charge: { status?: string | null } | null | undefined): boolean {
    return !['COMPLETED', 'FAILED', 'CANCELLED'].includes(charge?.status ?? '')
}

/**
 * The facts a success screen's receipt takes from the charge's history entry
 * once it loads: the amount, the status, the proof and the dates, and the
 * network fee with what the recipient received. The rest of the receipt stays
 * as the flow built it. The history projection carries no memo or attachment,
 * so replacing the whole receipt would drop the Comment and Attachment rows.
 *
 * Only a crypto withdrawal states a network fee. Every other charge here is
 * paid from the Peanut wallet, whose gas Peanut sponsors.
 */
export function settledReceiptFields(entry: HistoryEntry): Partial<TransactionDetails> {
    const canonical = mapTransactionDataForDrawer(entry).transactionDetails
    const isCryptoWithdraw = canonical.extraDataForDrawer?.kind === 'CRYPTO_WITHDRAW'
    return {
        amount: canonical.amount,
        status: canonical.status,
        // the hash and its explorer link travel together (see the transformer)
        ...(canonical.txHash && { txHash: canonical.txHash, explorerUrl: canonical.explorerUrl }),
        completedAt: canonical.completedAt,
        date: canonical.date,
        networkFeeDetails: isCryptoWithdraw ? canonical.networkFeeDetails : { state: 'sponsored' },
        recipientReceivesUsd: canonical.recipientReceivesUsd,
    }
}
