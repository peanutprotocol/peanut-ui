'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Address, Hash } from 'viem'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { spendMayHaveBroadcast, type SpendBroadcast } from '@/hooks/wallet/spendBroadcast'
import { type PaymentCreationResponse, type TRequestChargeResponse } from '@/services/services.types'
import { readUserOpOutcome } from '@/utils/userop-outcome'
import {
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
    PendingChargeSendNotSavedError,
    type PendingChargeSend,
} from '../utils/pending-charge-send'

/**
 * - `completed`: the charge is paid; the success screen shows.
 * - `sent`: the money left the wallet and the charge is not booked yet; the
 *   confirming screen shows, Pay stays off, and the next visit books it again.
 * - `not-sent`: proven that nothing moved; Pay is offered again.
 * - `in-flight`: a send may still land; the confirming screen shows and Pay stays off.
 * - `cancelled`: the screen was left; the next visit resumes.
 */
export type PendingSendOutcome = 'completed' | 'sent' | 'not-sent' | 'in-flight' | 'cancelled'

const RECOVERY_INTERVAL_MS = 3_000
const RECOVERY_WINDOW_MS = 60_000
const CLOSED_CHARGE = new Set(['FAILED', 'CANCELLED'])

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
    fetchCharge: (chargeId: string) => Promise<TRequestChargeResponse>
    /** Records the payment for a hash the recovery found. The flow adds chain, token and payer. */
    recordPayment: (chargeId: string, txHash: Hash) => Promise<PaymentCreationResponse>
    /** The flow shows a screen that can start a payment: a pending send resumes its recovery there. */
    canResume: boolean
    setCharge: (charge: TRequestChargeResponse) => void
    setPayment?: (payment: PaymentCreationResponse) => void
    setIsSuccess: (success: boolean) => void
    setIsPaymentStatusUnknown?: (unknown: boolean) => void
    setCurrentView: (view: 'INITIAL' | 'STATUS') => void
    setError: (error: { showError: boolean; errorMessage: string }) => void
}

/**
 * The double-send guard of the charge-backed wallet sends (direct send,
 * request pay, pot contribution), the Fixed variant of mono
 * engineering/api/state-machines/ChargeSendFlow.tla:
 *
 * 0. `claim` latches the tap before the first await, so a second tap in the
 *    same tick starts nothing; `release` lets it go once the attempt ended.
 * 1. `begin` saves a pending marker before anything is signed; `onBroadcast`
 *    adds each user op before it goes out; `markSent` adds the hash. When
 *    storage refuses `begin` or `onBroadcast`, they throw and nothing goes out.
 * 2. A failure after the send left this device (`mayHaveSent`) goes to
 *    `recover`, never back to the amount screen.
 * 3. `recover` reads the charge and the chain until the send is final. Pay
 *    comes back only when it is proven that nothing moved; a failed read
 *    proves nothing. The marker goes only then, or once the charge is booked.
 * 4. While a marker exists, `isPending` keeps Pay off, and a reload resumes
 *    the recovery.
 */
export function usePendingChargeSend({
    intent,
    walletAddress,
    fetchCharge,
    recordPayment,
    canResume,
    setCharge,
    setPayment,
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

    // Rendered state lags a tap: two taps in one tick both see Pay on. The
    // claim also writes a marker before the first await, so another tab's Pay
    // goes off while this tab creates the charge; `begin` fills it in.
    const claimed = useRef(false)
    const claim = useCallback(() => {
        if (claimed.current) return false
        if (key && (claiming.has(key) || sending.has(key) || recovering.has(key) || readPendingChargeSend(key))) {
            return false
        }
        claimed.current = true
        // a refused write is caught by `begin`, which stops the send
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
            return key && send ? writePendingChargeSend(key, change(send)) : true
        },
        [key]
    )

    // A marker left by a reload or an earlier visit resumes once; an attempt
    // started on this screen never does, so a recovery that ran out of time
    // waits for the next visit instead of starting over here.
    const hasResumed = useRef(false)

    const begin = useCallback(
        (chargeId: string) => {
            if (!key) return
            hasResumed.current = true
            claiming.delete(key)
            sending.add(key)
            const saved = writePendingChargeSend(key, {
                chargeId,
                owner: thisTab(),
                startedAt: Date.now(),
                userOps: [],
                backendBroadcast: false,
            })
            // a send this device could not remember after a reload is not started
            if (!saved) throw new PendingChargeSendNotSavedError()
        },
        [key]
    )

    // Runs before the send leaves this device: a throw here stops it.
    const onBroadcast = useCallback(
        (broadcast: SpendBroadcast) => {
            const saved = update((send) => {
                if (broadcast.via === 'backend') return { ...send, backendBroadcast: true }
                if (!broadcast.userOp) return { ...send, untrackedBroadcast: true }
                return { ...send, userOps: [...send.userOps, broadcast.userOp] }
            })
            if (!saved) throw new PendingChargeSendNotSavedError()
        },
        [update]
    )

    // The money already left: a refused write keeps the marker on this page.
    const markSent = useCallback(
        (txHash: Hash) => {
            update((send) => ({ ...send, txHash }))
        },
        [update]
    )

    const clear = useCallback(() => {
        claimed.current = false
        if (!key) return
        claiming.delete(key)
        sending.delete(key)
        writePendingChargeSend(key, null)
    }, [key])

    /** The failure came after the send left this device: the money may have moved. */
    const mayHaveSent = useCallback(
        (error: unknown) => spendMayHaveBroadcast(error) || !!(key && readPendingChargeSend(key)?.txHash),
        [key]
    )

    const recover = useCallback(async (): Promise<PendingSendOutcome> => {
        const finish = (outcome: Exclude<PendingSendOutcome, 'cancelled'>) => {
            // Only a booked charge or proof that nothing moved ends the guard.
            // `sent` keeps it: the money left and the charge may still book it.
            if (key && (outcome === 'completed' || outcome === 'not-sent')) writePendingChargeSend(key, null)
            if (outcome === 'not-sent') {
                setIsPaymentStatusUnknown?.(false)
                setError({ showError: true, errorMessage: t('errors.paymentNotSent') })
                setCurrentView('INITIAL')
            } else {
                setIsPaymentStatusUnknown?.(outcome !== 'completed')
                setIsSuccess(outcome === 'completed')
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
        setIsSuccess(false)
        setIsPaymentStatusUnknown?.(true)
        try {
            const deadline = Date.now() + RECOVERY_WINDOW_MS
            let recordTried = false
            for (;;) {
                let send = readPendingChargeSend(key)
                if (!send) return finish('in-flight')
                const charge = await fetchCharge(send.chargeId).catch(() => null)
                if (hasLeftScreen.current) return 'cancelled'
                if (charge) setCharge(charge)
                const status = charge?.status ?? ''
                if (status === 'COMPLETED') return finish('completed')

                if (!send.txHash) {
                    const outcomes = await Promise.all(
                        send.userOps.map((op) => (walletAddress ? readUserOpOutcome(op, walletAddress) : 'unknown'))
                    )
                    if (hasLeftScreen.current) return 'cancelled'
                    const executed = outcomes.find((outcome) => typeof outcome === 'object')
                    const pastWaitWindow = isPastWaitWindow(send)
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
                        // each op is proven unsent; `unknown` (a read failed) never is
                        outcomes.every(
                            (outcome, i) =>
                                outcome === 'reverted' ||
                                (outcome === 'nonce-spent' && minedNonces.has(ops[i].nonce)) ||
                                (outcome === 'not-found' && pastWaitWindow)
                        ) &&
                        // an op without a hash cannot be read
                        !send.untrackedBroadcast &&
                        // the backend owns a card-balance broadcast: only its closed charge proves it
                        (!send.backendBroadcast || CLOSED_CHARGE.has(status))
                    ) {
                        return finish('not-sent')
                    }
                }
                if (send.txHash) {
                    // Money left the wallet: a closed charge cannot book it, and the
                    // confirming screen sends the payer to support if it never shows.
                    if (CLOSED_CHARGE.has(status)) return finish('sent')
                    // PENDING means no payment was recorded. The backend answers a
                    // repeated hash idempotently, so every recovery tries once more.
                    if (status === 'PENDING' && !recordTried) {
                        recordTried = true
                        const payment = await recordPayment(send.chargeId, send.txHash).catch(() => null)
                        if (hasLeftScreen.current) return 'cancelled'
                        if (payment) setPayment?.(payment)
                        continue
                    }
                }
                if (Date.now() + RECOVERY_INTERVAL_MS > deadline) return finish(send.txHash ? 'sent' : 'in-flight')
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
        fetchCharge,
        recordPayment,
        setCharge,
        setPayment,
        setIsSuccess,
        setIsPaymentStatusUnknown,
        setCurrentView,
        setError,
        t,
    ])

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
    }, [canResume, key, walletAddress, recover])

    const isPending = parsePendingChargeSend(raw) !== null
    return useMemo(
        () => ({ isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover }),
        [isPending, isRecovering, claim, release, begin, onBroadcast, markSent, clear, mayHaveSent, recover]
    )
}
