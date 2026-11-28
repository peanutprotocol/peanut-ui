// Mirrors the recovery actions of verification/tla/ChargeSendFlow.tla (Fixed = TRUE).
import type { Hash } from 'viem'
import type { UserOpOutcome } from '@/utils/userop-outcome'
import { isPastWaitWindow, type PendingChargeSend, type SendOrderRead } from './pending-charge-send'

/** How long recovery waits between two reads of the order and the chain. */
export const RECOVERY_INTERVAL_MS = 3_000

export interface RecoveryRead {
    /** The marker as saved when this round began. */
    send: PendingChargeSend
    /** The order as its owner reports it; null when the read failed. */
    order: Pick<SendOrderRead, 'state' | 'txHash'> | null
    /** What the chain says of each of `send.userOps`, in order; absent until read. */
    outcomes?: UserOpOutcome[]
    /** The flow books a hash it found (`recordPayment`). */
    canRecord: boolean
    /** This recovery already tried to book the hash once. */
    recordTried: boolean
    now: number
    /** When this recovery stops waiting and shows the confirming screen. */
    deadline: number
}

/**
 * What recovery does next. The names are the model's actions; `ReadUserOps`
 * and `Wait` are steps inside one model action.
 * - `Recover`: proof. The order is booked (`completed`), or nothing moved (`not-sent`).
 * - `RecoverRecord`: money moved and the order is unbooked: book the hash.
 * - `RecoverTimeout`: the deadline passed, or money moved into a closed order:
 *   the confirming screen shows and the marker stays (`sent` once money
 *   moved, else `in-flight`).
 * - `ReleaseWarned`: no proof past the wait window: Pay comes back with the
 *   "could not be confirmed" error (`unconfirmed`).
 * - `ReadUserOps`: no hash is known: read each saved op on chain, then decide again.
 * - `Wait`: read the order and the chain again after {@link RECOVERY_INTERVAL_MS}.
 *
 * `foundTxHash` is a hash the marker does not hold yet: save it before acting.
 */
export type RecoveryAction = (
    | { action: 'Recover'; outcome: 'completed'; txHash?: Hash }
    | { action: 'Recover'; outcome: 'not-sent'; txHash?: undefined }
    | { action: 'RecoverRecord'; txHash: Hash }
    | { action: 'RecoverTimeout'; outcome: 'sent'; txHash: Hash }
    | { action: 'RecoverTimeout'; outcome: 'in-flight'; txHash?: undefined }
    | { action: 'ReleaseWarned' }
    | { action: 'ReadUserOps' }
    | { action: 'Wait' }
) & { foundTxHash?: Hash }

/** Each saved op is proven never to run, so nothing moved through the chain. */
function opsProvenUnsent(ops: PendingChargeSend['userOps'], outcomes: UserOpOutcome[]) {
    // A nonce another saved op of this send was mined with (it reverted): an
    // op of the same nonce without a receipt can never run.
    const minedNonces = new Set(ops.filter((_op, i) => outcomes[i] === 'reverted').map((op) => op.nonce))
    // `not-found` may still run, and `unknown` (a read failed) proves nothing
    return outcomes.every(
        (outcome, i) => outcome === 'reverted' || (outcome === 'nonce-spent' && minedNonces.has(ops[i].nonce))
    )
}

export function decideRecovery(
    read: RecoveryRead & { outcomes: UserOpOutcome[] }
): Exclude<RecoveryAction, { action: 'ReadUserOps' }>
export function decideRecovery(read: RecoveryRead): RecoveryAction
export function decideRecovery({
    send,
    order,
    outcomes,
    canRecord,
    recordTried,
    now,
    deadline,
}: RecoveryRead): RecoveryAction {
    if (order?.state === 'completed')
        return { action: 'Recover', outcome: 'completed', txHash: send.txHash ?? order.txHash }

    let txHash = send.txHash
    let foundTxHash: Hash | undefined
    // the order's owner holds the transfer: the money moved in it
    if (!txHash && order?.txHash) txHash = foundTxHash = order.txHash
    if (!txHash) {
        if (!outcomes) return { action: 'ReadUserOps' }
        const executed = outcomes.find((outcome) => typeof outcome === 'object')
        if (executed) {
            txHash = foundTxHash = executed.executed
        } else if (
            opsProvenUnsent(send.userOps, outcomes) &&
            // an op without a hash cannot be read
            !send.untrackedBroadcast &&
            // the backend owns its broadcast: only its closed order proves it
            (!send.backendBroadcast || order?.state === 'closed')
        ) {
            return { action: 'Recover', outcome: 'not-sent' }
        }
    }

    const found = foundTxHash ? { foundTxHash } : {}
    const pastWaitWindow = isPastWaitWindow(send, now)
    if (txHash) {
        // Money left the wallet: a closed order cannot book it, and the
        // confirming screen sends the payer to support if it never shows.
        if (order?.state === 'closed') {
            return pastWaitWindow
                ? { action: 'ReleaseWarned', ...found }
                : { action: 'RecoverTimeout', outcome: 'sent', txHash, ...found }
        }
        // `unbooked` means no payment was recorded. The owner answers a
        // repeated hash idempotently, so every recovery tries once more.
        if (canRecord && order?.state === 'unbooked' && !recordTried) {
            return { action: 'RecoverRecord', txHash, ...found }
        }
    }
    // Nothing proved either way within a day: Pay comes back, with the warning.
    if (pastWaitWindow) return { action: 'ReleaseWarned', ...found }
    if (now + RECOVERY_INTERVAL_MS > deadline) {
        return txHash
            ? { action: 'RecoverTimeout', outcome: 'sent', txHash, ...found }
            : { action: 'RecoverTimeout', outcome: 'in-flight' }
    }
    return { action: 'Wait', ...found }
}
