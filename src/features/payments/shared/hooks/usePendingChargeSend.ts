'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Address, Hash } from 'viem'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { spendMayHaveBroadcast, type SpendBroadcast } from '@/hooks/wallet/spendBroadcast'
import { readUserOpOutcome } from '@/utils/userop-outcome'
import {
    CLAIM_LEASE_MS,
    isAbandonedClaim,
    isPastWaitWindow,
    leftDevice,
    parsePendingChargeSend,
    pendingChargeSendKey,
    readPendingChargeSend,
    readPendingChargeSendRaw,
    subscribePendingChargeSend,
    thisTab,
    writePendingChargeSend,
    type PendingChargeSend,
    type SendOrderRead,
} from '../utils/pending-charge-send'

/**
 * - `completed`: the order is paid; the success screen shows.
 * - `sent`: the money left the wallet and the order is not booked yet; the
 *   confirming screen shows, Pay stays off, and the next visit reads the
 *   order again (and books the hash, where the flow books it).
 * - `not-sent`: proven that nothing moved; Pay is offered again.
 * - `in-flight`: a send may still land; the confirming screen shows and Pay stays off.
 * - `unconfirmed`: past the wait window with no proof either way; Pay is
 *   offered again with the "could not be confirmed" error.
 * - `cancelled`: the screen was left; the next visit resumes.
 */
export type PendingSendOutcome = 'completed' | 'sent' | 'not-sent' | 'in-flight' | 'unconfirmed' | 'cancelled'

const RECOVERY_INTERVAL_MS = 3_000
const RECOVERY_WINDOW_MS = 60_000

// Per page load, shared by every screen of a flow: an intent with a send
// running here is not resumed, and one recovery runs per intent.
const sending = new Set<string>()
const recovering = new Set<string>()
// claimed by a screen of this page and not begun yet
const claiming = new Set<string>()

interface PendingChargeSendOptions {
    /** What one payment is for, such as `direct-send:<recipient address>`. Null until known. */
    intent: string | null
    /** The user's smart account: the sender of every op the payment signed. */
    walletAddress: Address | undefined
    /** Reads the order the send pays from its owner. The flow keeps what it shows of it. */
    readOrder: (send: PendingChargeSend) => Promise<SendOrderRead>
    /**
     * Books a hash the recovery found on an `unbooked` order, and may resolve
     * with what puts the booking on the screen (called only while it is open).
     * Without it, the order's owner books the money that left the wallet, and
     * the recovery reads the order until it does.
     */
    recordPayment?: (send: PendingChargeSend, txHash: Hash) => Promise<(() => void) | void>
    /** The flow shows a screen that can start a payment: a pending send resumes its recovery there. */
    canResume: boolean
    setIsSuccess?: (success: boolean) => void
    /** The transfer the money moved in, once the recovery knows it. */
    setTxHash?: (txHash: Hash) => void
    setIsPaymentStatusUnknown?: (unknown: boolean) => void
    setCurrentView: (view: 'INITIAL' | 'STATUS') => void
    setError: (error: { showError: boolean; errorMessage: string }) => void
}

/**
 * The double-send guard of every wallet payment that pays an order (direct
 * send, request pay, pot contribution, crypto, Bridge and Manteca withdraw),
 * the Fixed variant of mono engineering/api/state-machines/ChargeSendFlow.tla:
 *
 * 0. `claim` latches the tap before the first await, so a second tap in the
 *    same tick starts nothing; `release` lets it go once the attempt ended.
 * 1. `begin` saves a pending marker before anything is signed; `onBroadcast`
 *    adds each send before it leaves this device, and throws (nothing goes
 *    out) when this attempt's marker is gone or another tab's; `markSent`
 *    adds the hash. When local storage refuses the marker, it lives in page
 *    memory: the guard holds on this page and the payment goes on.
 * 2. A failure after the send left this device (`mayHaveSent`) goes to
 *    `recover`, never back to the amount screen.
 * 3. `recover` reads the order and the chain until the send is final. Pay
 *    comes back when it is proven that nothing moved; a failed read proves
 *    nothing. The marker goes then, once the order is booked, or, past the
 *    wait window with no proof, with the "could not be confirmed" error.
 * 4. While a marker exists, `isPending` keeps Pay off, and a reload resumes
 *    the recovery. Another tab's unsent claim keeps it off for its lease only.
 */
export function usePendingChargeSend({
    intent,
    walletAddress,
    readOrder,
    recordPayment,
    canResume,
    setIsSuccess,
    setTxHash,
    setIsPaymentStatusUnknown,
    setCurrentView,
    setError,
}: PendingChargeSendOptions) {
    const t = useTranslations('payment')
    const { user } = useAuth()
    const userId = user?.user?.userId
    const key = userId && intent ? pendingChargeSendKey(userId, intent) : null
    const raw = useSyncExternalStore(
        subscribePendingChargeSend,
        () => (key ? readPendingChargeSendRaw(key) : null),
        () => null
    )
    const [isRecovering, setIsRecovering] = useState(false)

    const hasLeftScreen = useRef(false)
    useEffect(() => {
        hasLeftScreen.current = false
        return () => {
            hasLeftScreen.current = true
        }
    }, [])

    // Rendered state lags a tap: two taps in one tick both see Pay on. The
    // claim also writes a marker before the first await, so another tab's Pay
    // goes off while this tab creates the order; `begin` fills it in.
    const claimed = useRef(false)
    const claim = useCallback(() => {
        if (claimed.current) return false
        if (key && (claiming.has(key) || sending.has(key) || recovering.has(key) || readPendingChargeSend(key))) {
            return false
        }
        claimed.current = true
        if (key) {
            claiming.add(key)
            writePendingChargeSend(key, {
                chargeId: '',
                owner: thisTab(),
                startedAt: Date.now(),
                userOps: [],
                backendBroadcast: false,
            })
        }
        return true
    }, [key])
    const release = useCallback(() => {
        if (claimed.current && key) claiming.delete(key)
        claimed.current = false
        // an attempt that ended before `begin` leaves its claim behind
        const send = key ? readPendingChargeSend(key) : null
        if (key && send && !send.chargeId && send.owner === thisTab()) writePendingChargeSend(key, null)
    }, [key])

    const update = useCallback(
        (change: (send: PendingChargeSend) => PendingChargeSend) => {
            const send = key ? readPendingChargeSend(key) : null
            if (key && send) writePendingChargeSend(key, change(send))
        },
        [key]
    )

    // A marker left by a reload or an earlier visit resumes once; an attempt
    // started on this screen never does, so a recovery that ran out of time
    // waits for the next visit instead of starting over here.
    const hasResumed = useRef(false)
    const attemptChargeId = useRef<string | null>(null)

    const begin = useCallback(
        (chargeId: string, intentId?: string) => {
            if (!key) return
            hasResumed.current = true
            attemptChargeId.current = chargeId
            claiming.delete(key)
            sending.add(key)
            writePendingChargeSend(key, {
                chargeId,
                ...(intentId ? { intentId } : {}),
                owner: thisTab(),
                startedAt: Date.now(),
                userOps: [],
                backendBroadcast: false,
            })
        },
        [key]
    )

    // Runs before the send leaves this device: a throw here stops it. Another
    // tab drops this attempt's marker once its lease ran out, and may then
    // claim its own: a send without its marker would go unguarded.
    const onBroadcast = useCallback(
        (broadcast: SpendBroadcast) => {
            if (!key) return
            const held = readPendingChargeSend(key)
            if (!held || held.owner !== thisTab() || held.chargeId !== attemptChargeId.current) {
                throw new Error('This payment is no longer held on this device')
            }
            update((send) => {
                if (broadcast.via === 'backend') return { ...send, backendBroadcast: true }
                if (!broadcast.userOp) return { ...send, untrackedBroadcast: true }
                return { ...send, userOps: [...send.userOps, broadcast.userOp] }
            })
        },
        [key, update]
    )

    // The money already left: a refused write keeps the marker on this page.
    const markSent = useCallback((txHash: Hash) => update((send) => ({ ...send, txHash })), [update])

    const clear = useCallback(() => {
        claimed.current = false
        if (!key) return
        claiming.delete(key)
        sending.delete(key)
        // another tab's claim may have replaced this attempt's marker
        const send = readPendingChargeSend(key)
        if (send && send.owner !== undefined && send.owner !== thisTab()) return
        writePendingChargeSend(key, null)
    }, [key])

    /** The failure came after the send left this device: the money may have moved. */
    const mayHaveSent = useCallback(
        (error: unknown) => spendMayHaveBroadcast(error) || !!(key && readPendingChargeSend(key)?.txHash),
        [key]
    )

    const recover = useCallback(async (): Promise<PendingSendOutcome> => {
        const finish = (outcome: Exclude<PendingSendOutcome, 'cancelled'>, txHash?: Hash) => {
            // A booked order, proof that nothing moved, or the end of the wait
            // window ends the guard. `sent` keeps it: the order may still book it.
            const ends = outcome === 'completed' || outcome === 'not-sent' || outcome === 'unconfirmed'
            if (key && ends) writePendingChargeSend(key, null)
            if (outcome === 'not-sent' || outcome === 'unconfirmed') {
                setIsPaymentStatusUnknown?.(false)
                setError({
                    showError: true,
                    errorMessage: t(
                        outcome === 'not-sent' ? 'errors.paymentNotSent' : 'errors.externalPaymentNotConfirmed'
                    ),
                })
                setCurrentView('INITIAL')
            } else {
                if (txHash) setTxHash?.(txHash)
                setIsPaymentStatusUnknown?.(outcome !== 'completed')
                setIsSuccess?.(outcome === 'completed')
                setCurrentView('STATUS')
            }
            return outcome
        }
        // Without a marker nothing can be looked up: the safe answer is the
        // confirming screen, never Pay again.
        if (!key) return finish('in-flight')
        if (recovering.has(key)) return 'in-flight'
        recovering.add(key)
        setIsRecovering(true)
        setIsSuccess?.(false)
        setIsPaymentStatusUnknown?.(true)
        try {
            const deadline = Date.now() + RECOVERY_WINDOW_MS
            let recordTried = false
            for (;;) {
                let send = readPendingChargeSend(key)
                if (!send) return finish('in-flight')
                const order = await readOrder(send).catch(() => null)
                if (hasLeftScreen.current) return 'cancelled'
                order?.show?.()
                if (order?.state === 'completed') return finish('completed', send.txHash ?? order.txHash)
                // the order's owner holds the transfer: the money moved in it
                if (!send.txHash && order?.txHash) {
                    send = { ...send, txHash: order.txHash }
                    writePendingChargeSend(key, send)
                }

                if (!send.txHash) {
                    const outcomes = await Promise.all(
                        send.userOps.map((op) => (walletAddress ? readUserOpOutcome(op, walletAddress) : 'unknown'))
                    )
                    if (hasLeftScreen.current) return 'cancelled'
                    const executed = outcomes.find((outcome) => typeof outcome === 'object')
                    // A nonce another saved op of this send was mined with (it reverted):
                    // an op of the same nonce without a receipt can never run.
                    const ops = send.userOps
                    const minedNonces = new Set(
                        ops.filter((_op, i) => outcomes[i] === 'reverted').map((op) => op.nonce)
                    )
                    if (executed) {
                        send = { ...send, txHash: executed.executed }
                        writePendingChargeSend(key, send)
                    } else if (
                        // each op is proven unsent: `not-found` may still run, and
                        // `unknown` (a read failed) proves nothing
                        outcomes.every(
                            (outcome, i) =>
                                outcome === 'reverted' || (outcome === 'nonce-spent' && minedNonces.has(ops[i].nonce))
                        ) &&
                        // an op without a hash cannot be read
                        !send.untrackedBroadcast &&
                        // the backend owns its broadcast: only its closed order proves it
                        (!send.backendBroadcast || order?.state === 'closed')
                    ) {
                        return finish('not-sent')
                    }
                }
                if (send.txHash) {
                    // Money left the wallet: a closed order cannot book it, and the
                    // confirming screen sends the payer to support if it never shows.
                    if (order?.state === 'closed') {
                        return finish(isPastWaitWindow(send) ? 'unconfirmed' : 'sent', send.txHash)
                    }
                    // `unbooked` means no payment was recorded. The owner answers a
                    // repeated hash idempotently, so every recovery tries once more.
                    if (recordPayment && order?.state === 'unbooked' && !recordTried) {
                        recordTried = true
                        const recorded = await recordPayment(send, send.txHash).then(
                            (show) => ({ show }),
                            () => null
                        )
                        if (hasLeftScreen.current) return 'cancelled'
                        if (recorded) {
                            recorded.show?.()
                            return finish('completed', send.txHash)
                        }
                        continue
                    }
                }
                // Nothing proved either way within a day: Pay comes back, with the warning.
                if (isPastWaitWindow(send)) return finish('unconfirmed')
                if (Date.now() + RECOVERY_INTERVAL_MS > deadline) {
                    return send.txHash ? finish('sent', send.txHash) : finish('in-flight')
                }
                await new Promise((resolve) => setTimeout(resolve, RECOVERY_INTERVAL_MS))
                if (hasLeftScreen.current) return 'cancelled'
            }
        } finally {
            recovering.delete(key)
            sending.delete(key)
            claiming.delete(key)
            claimed.current = false
            setIsRecovering(false)
        }
    }, [
        key,
        walletAddress,
        readOrder,
        recordPayment,
        setIsSuccess,
        setTxHash,
        setIsPaymentStatusUnknown,
        setCurrentView,
        setError,
        t,
    ])

    // Another tab's unsent claim ends with its lease, also while this screen stays open.
    const [leaseEnded, setLeaseEnded] = useState(0)
    useEffect(() => {
        const send = parsePendingChargeSend(raw)
        if (!send || leftDevice(send) || isAbandonedClaim(send)) return
        const timer = setTimeout(
            () => setLeaseEnded(Date.now()),
            Math.max(0, send.startedAt + CLAIM_LEASE_MS - Date.now()) + 1
        )
        return () => clearTimeout(timer)
    }, [raw, leaseEnded])

    useEffect(() => {
        if (!canResume || !key || hasResumed.current || claiming.has(key) || sending.has(key) || recovering.has(key)) {
            return
        }
        const send = readPendingChargeSend(key)
        if (!send) return
        // Nothing left the device yet: this tab's marker from before a reload
        // goes; another tab's live attempt keeps Pay off until it ends.
        if (isAbandonedClaim(send)) {
            writePendingChargeSend(key, null)
            return
        }
        // another tab's attempt that has sent nothing: nothing to look up yet
        if (!leftDevice(send)) return
        // the chain reads need the sender, which loads after a reload
        if (send.userOps.length > 0 && !walletAddress) return
        hasResumed.current = true
        void recover()
    }, [canResume, key, walletAddress, recover, leaseEnded])

    const marker = parsePendingChargeSend(raw)
    const isLocal = !!key && (claiming.has(key) || sending.has(key) || recovering.has(key))
    const isPending = marker !== null && (isLocal || !isAbandonedClaim(marker))
    return useMemo(
        () => ({ isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover }),
        [isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover]
    )
}
