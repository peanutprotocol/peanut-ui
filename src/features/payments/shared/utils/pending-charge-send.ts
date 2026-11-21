import type { Hash } from 'viem'
import type { BroadcastUserOp } from '@/hooks/wallet/spendBroadcast'

/**
 * A payment this device started and may have sent. While one exists for an
 * intent, Pay stays off and a reload resumes the recovery, so a lost answer
 * can never turn into a second transfer (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, the Fixed variant).
 *
 * Local storage, per user and intent, so it survives the app being killed. It
 * holds ids and hashes only, never personal data (mono design/design.md § state).
 */
export interface PendingChargeSend {
    /** The order the send pays: a charge id, or the provider's transfer or preparation id. */
    chargeId: string
    /** The ledger intent of that order, for a flow that reads the order's state there. */
    intentId?: string
    /** When the send began (ms). */
    startedAt: number
    /** Every user op this device signed for the charge, saved before it went to the bundler. */
    userOps: BroadcastUserOp[]
    /** The backend was asked to broadcast the send (card balance). */
    backendBroadcast: boolean
    /** A user op was handed to the bundler but its hash could not be computed. */
    untrackedBroadcast?: boolean
    /** The hash the send resolved with: the money left the wallet. */
    txHash?: Hash
}

/**
 * Where the order a send pays stands, as its owner (the charge, the provider
 * transfer) reports it:
 * - `completed`: the payment is booked.
 * - `unbooked`: open, with no payment recorded: recovery records the hash it found.
 * - `settling`: open, and its owner is still working on it: recovery waits.
 * - `closed`: failed or cancelled: it can book nothing.
 */
export type SendOrderState = 'completed' | 'unbooked' | 'settling' | 'closed'
export interface SendOrderRead {
    state: SendOrderState
    /** The transfer the owner holds for this order, when it knows one. */
    txHash?: Hash
}

export function chargeOrderState(status: string | null | undefined): SendOrderState {
    if (status === 'COMPLETED') return 'completed'
    if (status === 'PENDING') return 'unbooked'
    if (status === 'FAILED' || status === 'CANCELLED') return 'closed'
    return 'settling'
}

const PREFIX = 'peanut:pendingChargeSend:'
/**
 * A signed op the bundler has not executed in a day left its mempool long ago.
 * Past this, recovery counts an op it still cannot find as dropped: an
 * assumption about the bundler, not a proof (the Drop action in the model).
 * The marker is never dropped unread, so an op that did execute is still found.
 */
const WAIT_WINDOW_MS = 24 * 60 * 60 * 1000
export const isPastWaitWindow = (send: PendingChargeSend) => Date.now() - send.startedAt > WAIT_WINDOW_MS
const listeners = new Set<() => void>()
// Where storage is unavailable (private mode, full), the guard still holds for this page.
const memory = new Map<string, string>()

export const pendingChargeSendKey = (userId: string, intent: string) => `${PREFIX}${userId}:${intent}`

/** True once anything left this device: before that, a reload cannot have sent money. */
export const leftDevice = (send: PendingChargeSend) =>
    send.userOps.length > 0 || send.backendBroadcast || !!send.untrackedBroadcast || !!send.txHash

export function readPendingChargeSendRaw(key: string): string | null {
    try {
        return window.localStorage.getItem(key)
    } catch {
        return memory.get(key) ?? null
    }
}

export function parsePendingChargeSend(raw: string | null): PendingChargeSend | null {
    if (!raw) return null
    try {
        const send = JSON.parse(raw) as PendingChargeSend
        return typeof send?.chargeId === 'string' && typeof send.startedAt === 'number' && Array.isArray(send.userOps)
            ? send
            : null
    } catch {
        return null
    }
}

export const readPendingChargeSend = (key: string) => parsePendingChargeSend(readPendingChargeSendRaw(key))

export function writePendingChargeSend(key: string, send: PendingChargeSend | null) {
    const raw = send ? JSON.stringify(send) : null
    try {
        if (raw) window.localStorage.setItem(key, raw)
        else window.localStorage.removeItem(key)
    } catch {
        if (raw) memory.set(key, raw)
        else memory.delete(key)
    }
    listeners.forEach((listener) => listener())
}

/** Also hears other tabs: a send started in one keeps Pay off in the others. */
export function subscribePendingChargeSend(listener: () => void) {
    listeners.add(listener)
    window.addEventListener('storage', listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', listener)
    }
}
