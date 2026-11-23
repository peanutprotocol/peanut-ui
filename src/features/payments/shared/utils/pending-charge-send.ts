import { keccak256, stringToBytes, type Hash } from 'viem'
import type { BroadcastUserOp } from '@/hooks/wallet/spendBroadcast'

/**
 * A payment this device started and may have sent. While one exists for an
 * intent, Pay stays off and a reload resumes the recovery, so a lost answer
 * can never turn into a second transfer
 * (verification/tla/ChargeSendFlow.tla, the Fixed variant).
 *
 * Local storage, per user and intent, so it survives the app being killed and
 * sign-out. It holds ids and hashes; no key holds an account in plain text
 * ({@link mantecaWithdrawIntent}).
 */
export interface PendingChargeSend {
    /**
     * The order the send pays: a charge id, or the provider's transfer or
     * preparation id. Empty while the tap is claimed and the order is not created yet.
     */
    chargeId: string
    /** The ledger intent of that order, for a flow that reads the order's state there. */
    intentId?: string
    /** The tab that wrote it ({@link thisTab}); absent on markers written before tabs were told apart. */
    owner?: string
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
    /** Puts what was read on the screen; the recovery calls it only while the screen is still open. */
    show?: () => void
}

export function chargeOrderState(status: string | null | undefined): SendOrderState {
    if (status === 'COMPLETED') return 'completed'
    if (status === 'PENDING') return 'unbooked'
    if (status === 'FAILED' || status === 'CANCELLED') return 'closed'
    return 'settling'
}

const PREFIX = 'peanut:pendingChargeSend:'
/**
 * How long a hold may last without proof. Past it, recovery that proves
 * neither a booked charge nor that nothing moved drops the marker and offers
 * Pay again with the "could not be confirmed" error (`unconfirmed`, the
 * ReleaseWarned action in the model). Nothing else bounds an op that is still
 * valid, a card-balance send whose charge stays open, or money that moved
 * into a charge that never books.
 */
const WAIT_WINDOW_MS = 24 * 60 * 60 * 1000
export const isPastWaitWindow = (send: PendingChargeSend, now: number) => now - send.startedAt > WAIT_WINDOW_MS
const listeners = new Set<() => void>()
// A marker local storage refused (full, blocked, private mode) is kept here
// and read first: the guard holds for the life of this page, and the payment
// goes on as it would without the guard.
const memory = new Map<string, string>()

export const pendingChargeSendKey = (userId: string, intent: string) => `${PREFIX}${userId}:${intent}`

/**
 * A Manteca withdrawal's intent: one withdrawal per destination at a time. The
 * destination (a CBU, alias or Pix key) is personal data, so the key holds only
 * a hash of it with the user id. The marker then stays at sign-out, and a lost
 * answer still holds the same user's withdraw after they sign in again. The
 * user id is in the key too, so a guessable Pix key (CPF, phone) can be found
 * from the hash by brute force: the hash hides, it does not protect.
 */
export const mantecaWithdrawIntent = (userId: string, destination: string) =>
    `withdraw-manteca:${keccak256(stringToBytes(`${userId}:${destination}`))}`

const TAB_KEY = 'peanut:pendingChargeSend:tab'
let tab: string | undefined
/** This tab's id. Session storage keeps it across a reload, and another tab has its own. */
export function thisTab(): string {
    if (tab) return tab
    try {
        tab = window.sessionStorage.getItem(TAB_KEY) ?? undefined
    } catch {
        // without session storage, a reload looks like another tab: its marker waits out the lease
    }
    if (!tab) {
        tab = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        try {
            window.sessionStorage.setItem(TAB_KEY, tab)
        } catch {}
    }
    return tab
}

/**
 * Another tab's attempt that has sent nothing yet keeps Pay off this long at
 * most: past it, that tab was closed before its send left the device.
 */
export const CLAIM_LEASE_MS = 15 * 60 * 1000

/**
 * A marker that sent nothing and may be dropped: this tab wrote it before a
 * reload, or another tab's lease ran out. Another tab's live attempt is never
 * dropped, so its Pay tap keeps this tab's Pay off.
 */
export const isAbandonedClaim = (send: PendingChargeSend) =>
    !leftDevice(send) &&
    (send.owner === undefined || send.owner === thisTab() || Date.now() - send.startedAt > CLAIM_LEASE_MS)

/** True once anything left this device: before that, a reload cannot have sent money. */
export const leftDevice = (send: PendingChargeSend) =>
    send.userOps.length > 0 || send.backendBroadcast || !!send.untrackedBroadcast || !!send.txHash

export function readPendingChargeSendRaw(key: string): string | null {
    const kept = memory.get(key)
    if (kept !== undefined) return kept
    try {
        return window.localStorage.getItem(key)
    } catch {
        return null
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

/**
 * When local storage refuses the write, the marker lives in this page only.
 * A marker that could not be removed stays in storage, so the guard fails
 * closed.
 */
export function writePendingChargeSend(key: string, send: PendingChargeSend | null) {
    const raw = send ? JSON.stringify(send) : null
    let persisted = true
    try {
        if (raw) window.localStorage.setItem(key, raw)
        else window.localStorage.removeItem(key)
    } catch {
        persisted = false
    }
    if (raw && !persisted) memory.set(key, raw)
    else memory.delete(key)
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
