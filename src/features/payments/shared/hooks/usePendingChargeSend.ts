'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Address, Hash } from 'viem'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { spendMayHaveBroadcast, type SpendBroadcast } from '@/hooks/wallet/spendBroadcast'
import { readUserOpOutcome } from '@/utils/userop-outcome'
import {
    isPastWaitWindow,
    leftDevice,
    parsePendingChargeSend,
    pendingChargeSendKey,
    readPendingChargeSend,
    readPendingChargeSendRaw,
    subscribePendingChargeSend,
    writePendingChargeSend,
    type PendingChargeSend,
    type SendOrderRead,
} from '../utils/pending-charge-send'

/**
 * - `completed`: the order is paid; the success screen shows.
 * - `sent`: the money left the wallet and the order is not booked yet; the
 *   confirming screen shows.
 * - `not-sent`: proven that nothing moved; Pay is offered again.
 * - `in-flight`: a send may still land; the confirming screen shows and Pay stays off.
 * - `cancelled`: the screen was left; the next visit resumes.
 */
export type PendingSendOutcome = 'completed' | 'sent' | 'not-sent' | 'in-flight' | 'cancelled'

const RECOVERY_INTERVAL_MS = 3_000
const RECOVERY_WINDOW_MS = 60_000

// Per page load, shared by every screen of a flow: an intent with a send
// running here is not resumed, and one recovery runs per intent.
const sending = new Set<string>()
const recovering = new Set<string>()

interface PendingChargeSendOptions {
    /** What one payment is for, such as `direct-send:<recipient address>`. Null until known. */
    intent: string | null
    /** The user's smart account: the sender of every op the payment signed. */
    walletAddress: Address | undefined
    /** Reads the order the send pays from its owner. The flow keeps what it shows of it. */
    readOrder: (send: PendingChargeSend) => Promise<SendOrderRead>
    /**
     * Books a hash the recovery found on an `unbooked` order. Without it, money
     * that left the wallet ends as `sent`: the order's owner books it.
     */
    recordPayment?: (send: PendingChargeSend, txHash: Hash) => Promise<unknown>
    /** The flow shows a screen that can start a payment: a pending send resumes its recovery there. */
    canResume: boolean
    /** `txHash`: the transfer the money moved in, when the recovery knows it. */
    setIsSuccess?: (success: boolean, txHash?: Hash) => void
    setIsPaymentStatusUnknown?: (unknown: boolean) => void
    setCurrentView: (view: 'INITIAL' | 'STATUS') => void
    setError: (error: { showError: boolean; errorMessage: string }) => void
}

/**
 * The double-send guard of every wallet payment that pays an order (direct
 * send, request pay, pot contribution, crypto, Bridge and Manteca withdraw),
 * the Fixed variant of mono engineering/api/state-machines/ChargeSendFlow.tla:
 *
 * 1. `claim` latches the tap before the first await, so a second tap in the
 *    same tick starts nothing; `release` lets it go once the attempt ended.
 * 2. `begin` saves a pending marker before anything is signed; `onBroadcast`
 *    adds each send before it leaves this device; `markSent` adds the hash.
 * 3. A failure after the send left this device (`mayHaveSent`) goes to
 *    `recover`, never back to the amount screen.
 * 4. `recover` reads the order and the chain until the send is final. Pay
 *    comes back only when it is proven that nothing moved.
 * 5. While a marker exists, `isPending` keeps Pay off, and a reload resumes
 *    the recovery.
 */
export function usePendingChargeSend({
    intent,
    walletAddress,
    readOrder,
    recordPayment,
    canResume,
    setIsSuccess,
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

    // Rendered state lags a tap: two taps in one tick both see Pay on.
    const claimed = useRef(false)
    const claim = useCallback(() => {
        if (claimed.current) return false
        if (key && (sending.has(key) || recovering.has(key) || readPendingChargeSend(key))) return false
        claimed.current = true
        return true
    }, [key])
    const release = useCallback(() => {
        claimed.current = false
    }, [])

    const update = useCallback(
        (change: (send: PendingChargeSend) => PendingChargeSend) => {
            const send = key ? readPendingChargeSend(key) : null
            if (key && send) writePendingChargeSend(key, change(send))
        },
        [key]
    )

    const begin = useCallback(
        (chargeId: string, intentId?: string) => {
            if (!key) return
            sending.add(key)
            writePendingChargeSend(key, {
                chargeId,
                ...(intentId ? { intentId } : {}),
                startedAt: Date.now(),
                userOps: [],
                backendBroadcast: false,
            })
        },
        [key]
    )

    const onBroadcast = useCallback(
        (broadcast: SpendBroadcast) =>
            update((send) => {
                if (broadcast.via === 'backend') return { ...send, backendBroadcast: true }
                if (!broadcast.userOp) return { ...send, untrackedBroadcast: true }
                return { ...send, userOps: [...send.userOps, broadcast.userOp] }
            }),
        [update]
    )

    const markSent = useCallback((txHash: Hash) => update((send) => ({ ...send, txHash })), [update])

    const clear = useCallback(() => {
        claimed.current = false
        if (!key) return
        sending.delete(key)
        writePendingChargeSend(key, null)
    }, [key])

    /** The failure came after the send left this device: the money may have moved. */
    const mayHaveSent = useCallback(
        (error: unknown) => spendMayHaveBroadcast(error) || !!(key && readPendingChargeSend(key)?.txHash),
        [key]
    )

    const recover = useCallback(async (): Promise<PendingSendOutcome> => {
        const finish = (outcome: Exclude<PendingSendOutcome, 'cancelled'>, txHash?: Hash) => {
            if (key && outcome !== 'in-flight') writePendingChargeSend(key, null)
            if (outcome === 'not-sent') {
                setIsPaymentStatusUnknown?.(false)
                setError({ showError: true, errorMessage: t('errors.paymentNotSent') })
                setCurrentView('INITIAL')
            } else {
                setIsPaymentStatusUnknown?.(outcome !== 'completed')
                setIsSuccess?.(outcome === 'completed', txHash)
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
                if (order?.state === 'completed') return finish('completed', send.txHash ?? order.txHash)
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
                    if (executed) {
                        send = { ...send, txHash: executed.executed }
                        writePendingChargeSend(key, send)
                    } else if (
                        isPastWaitWindow(send) ||
                        (outcomes.every((outcome) => outcome === 'reverted' || outcome === 'replaced') &&
                            !send.untrackedBroadcast &&
                            // the backend owns its broadcast: its order says how it ended
                            (!send.backendBroadcast || order?.state === 'closed'))
                    ) {
                        return finish('not-sent')
                    }
                }
                if (send.txHash) {
                    // Money left the wallet: a closed order cannot book it, an order
                    // the flow does not book is its owner's to book, and the
                    // confirming screen sends the payer to support if it never shows.
                    if (order?.state === 'closed' || !recordPayment) return finish('sent', send.txHash)
                    // `unbooked` means no payment was recorded. The owner answers a
                    // repeated hash idempotently.
                    if (order?.state === 'unbooked' && !recordTried) {
                        recordTried = true
                        const recorded = await recordPayment(send, send.txHash).then(
                            () => true,
                            () => false
                        )
                        if (hasLeftScreen.current) return 'cancelled'
                        if (recorded) return finish('completed', send.txHash)
                        continue
                    }
                }
                if (Date.now() + RECOVERY_INTERVAL_MS > deadline) {
                    return send.txHash ? finish('sent', send.txHash) : finish('in-flight')
                }
                await new Promise((resolve) => setTimeout(resolve, RECOVERY_INTERVAL_MS))
                if (hasLeftScreen.current) return 'cancelled'
            }
        } finally {
            recovering.delete(key)
            sending.delete(key)
            claimed.current = false
            setIsRecovering(false)
        }
    }, [
        key,
        walletAddress,
        readOrder,
        recordPayment,
        setIsSuccess,
        setIsPaymentStatusUnknown,
        setCurrentView,
        setError,
        t,
    ])

    // A marker left by a reload or an earlier visit: resume its recovery once.
    const hasResumed = useRef(false)
    useEffect(() => {
        if (!canResume || !key || hasResumed.current || sending.has(key) || recovering.has(key)) return
        const send = readPendingChargeSend(key)
        if (!send) return
        // the chain reads need the sender, which loads after a reload
        if (send.userOps.length > 0 && !walletAddress) return
        hasResumed.current = true
        // Nothing left this device before the reload: no money can have moved.
        if (!leftDevice(send)) {
            writePendingChargeSend(key, null)
            return
        }
        void recover()
    }, [canResume, key, walletAddress, recover])

    const isPending = parsePendingChargeSend(raw) !== null
    return useMemo(
        () => ({ isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover }),
        [isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover]
    )
}
