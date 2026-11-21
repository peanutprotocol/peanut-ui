import type { Hash } from 'viem'
import type { BroadcastUserOp } from '@/hooks/wallet/spendBroadcast'

/**
 * A charge payment this device started and may have sent. While one exists for
 * an intent, Pay stays off and a reload resumes the recovery, so a lost answer
 * can never turn into a second transfer (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, the Fixed variant).
 *
 * Local storage, per user and intent, so it survives the app being killed. It
 * holds ids and hashes only, never personal data (mono design/design.md § state).
 */
export interface PendingChargeSend {
    chargeId: string
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

const PREFIX = 'peanut:pendingChargeSend:'
/**
 * A signed op the bundler has not executed in a day left its mempool long ago.
 * Past this, recovery counts an op that every read answered for, and found
 * nowhere, as dropped: an assumption about the bundler, not a proof (the Drop
 * action in the model). A read that failed never counts: age alone releases
 * nothing.
 */
const WAIT_WINDOW_MS = 24 * 60 * 60 * 1000
export const isPastWaitWindow = (send: PendingChargeSend) => Date.now() - send.startedAt > WAIT_WINDOW_MS
const listeners = new Set<() => void>()
// A marker local storage refused (full, blocked) is kept here and read first,
// so the guard still holds on this page.
const memory = new Map<string, string>()

/** Local storage refused the marker: a send it should guard must not start. */
export class PendingChargeSendNotSavedError extends Error {
    constructor() {
        super('The pending payment marker could not be saved on this device')
        this.name = 'PendingChargeSendNotSavedError'
    }
}

export const pendingChargeSendKey = (userId: string, intent: string) => `${PREFIX}${userId}:${intent}`

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
 * False when local storage refused the write: the marker then lives in this
 * page only, and a reload would lose it. A marker that could not be removed
 * stays in storage, so the guard fails closed.
 */
export function writePendingChargeSend(key: string, send: PendingChargeSend | null): boolean {
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
    return persisted
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
