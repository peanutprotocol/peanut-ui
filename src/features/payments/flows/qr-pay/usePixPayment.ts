'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import type { Address } from 'viem'
import * as Sentry from '@/utils/sentry-lazy'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useDebounce } from '@/hooks/useDebounce'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { isUserCancellation } from '@/hooks/wallet/spendPreflight'
import { pixApi, type PixPayDisplay, type PixPayOpened, type PixPayment } from '@/services/pix'
import { API_ERROR_CODES, ApiError, wireErrorCode } from '@/services/api-error'
import { quoteMovedAgainstUser, signMatchesDisplay, toApiDecimal } from '@/features/pix/pixFlow.utils'
import { isUnderPixMinimum } from '@/features/pix/pixQuote.utils'
import { clearDepositMaybeSent, depositMaybeSent, markDepositMaybeSent } from '@/features/pix/pixWithdrawSent'
import { usePixRefusalMessage } from '@/features/pix/usePixRefusalMessage'
import { BALANCE_DECREASE, TRANSACTIONS } from '@/constants/query.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { areEvmAddressesEqual, isTxReverted } from '@/utils/general.utils'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { qrInitIdempotencyKey } from '@/utils/qr-payment.utils'
import { rhinoDepositWithIdCalls } from '@/utils/rhino-deposit.utils'
import { sleepUnlessCancelled } from '@/utils/cancellable-wait'
import { QR_INIT_CODE } from './init-error-classifier'
import {
    createQrPaymentAttemptTelemetry,
    trackPixQrInitResult,
    type QrPaymentAttemptTelemetry,
    type QrPaymentStageOutcome,
    type QrPaymentStageProvider,
} from './qr-payment-telemetry'
import { pixQrHost } from '@/utils/pix-qr-host'

const flowTags = (step: string) => ({ ...criticalFlowTags('qr-pay'), qr_pay_step: step, qr_pay_route: 'pix' })

/** The read is polled while the payment moves (API-CONTRACT-M4 §2.4: every 3 to 5 s). */
const READ_POLL_MS = 4_000
/** How long the processing screen waits when no quote states an arrival time (a reload). */
const FALLBACK_ARRIVAL_SECONDS = 90
/** A retried open that the first request still holds (`QR_INIT_IN_PROGRESS`) waits this long, this often. */
const OPEN_IN_PROGRESS_RETRIES = 3
const OPEN_IN_PROGRESS_WAIT_MS = 1_500
/** The pay routes' key for one balance-decreasing payment, so no second one starts while it is pending. */
const PIX_PAY = 'pix-pay'

/**
 * Where one payment stands, for the screens the QR flow already has:
 * - `processing`: the USDC left (or may have left) the wallet and the provider is paying the merchant.
 * - `paid`, `refunded` (returning or back), `cancelled` (nothing left the wallet).
 * - `not-sent`: opened, but this device never signed it; the provider lets it lapse.
 * - `needs-support`: a person at Peanut is looking at it.
 */
export type PixPayOutcome = 'processing' | 'paid' | 'refunded' | 'cancelled' | 'not-sent' | 'needs-support'

/** What this session did with the payment: nothing yet, its open or signature in flight, or sent. */
type PayPhase = 'idle' | 'opening' | 'signing' | 'sent' | 'unconfirmed'

const TERMINAL_STATES: ReadonlySet<PixPayment['state']> = new Set(['paid', 'refunded', 'cancelled', 'needs_support'])

export function pixPayOutcome(
    payment: Pick<PixPayment, 'state'> | undefined,
    { mayHaveSent }: { mayHaveSent: boolean }
): PixPayOutcome | null {
    if (!payment) return mayHaveSent ? 'processing' : null
    switch (payment.state) {
        case 'paid':
            return 'paid'
        case 'refunding':
        case 'refunded':
            return 'refunded'
        case 'cancelled':
            return 'cancelled'
        case 'needs_support':
            return 'needs-support'
        case 'awaiting_signature':
            return mayHaveSent ? 'processing' : 'not-sent'
        case 'opening':
        case 'processing':
            return 'processing'
    }
}

type DepositWithIdSign = Extract<PixPayOpened['sign'], { kind: 'deposit-with-id' }>

/** How one attempt ends, by the payment's outcome: the same `attempt_finished` Manteca's attempts report. */
const ATTEMPT_OUTCOME: Record<Exclude<PixPayOutcome, 'processing'>, QrPaymentStageOutcome> = {
    paid: 'success',
    refunded: 'failed',
    cancelled: 'failed',
    'not-sent': 'failed',
    'needs-support': 'unknown',
}

/**
 * A merchant Pix code paid through the neutral pay routes (API-CONTRACT-M4): the code's review,
 * then one bridge from the wallet that the provider turns into the Pix to the merchant.
 *
 * The review reads the code once without an amount. A code with its own amount answers with it; a
 * code without one answers `PAYMENT_DESTINATION_MISSING_AMOUNT`, and the reais the user types are
 * reviewed again (debounced). An amount under the route's minimum is never sent.
 *
 * Pay opens the payment with one idempotency key per scan and amount: a retry of the same tap opens
 * nothing new, and a payment already past its signature (`PIX_PAYMENT_EXISTS`) is read, not paid
 * again. The open's id goes in the URL (`?intentId=`), so a reload shows that payment. The wallet
 * signs Rhino's `depositWithId`, the mined hash is reported, and the read says how it ends.
 */
export function usePixPayment({
    brCode,
    timestamp,
    enabled,
    canStart,
    amountBrl,
    minimumBrl,
    provider,
}: {
    brCode: string
    timestamp: string | null
    /** The pay route names the neutral routes. */
    enabled: boolean
    /** Nothing blocks a new payment (a pause still lets an opened one show its outcome). */
    canStart: boolean
    /** The reais the user typed, for a code without an amount of its own. */
    amountBrl: string | undefined
    /** The route's least amount, in reais (`route.limits`); null where it states none. */
    minimumBrl: string | null
    /** The provider the pay route names: data for analytics only, never a branch. */
    provider?: QrPaymentStageProvider | null
}) {
    const t = useAppTranslations('qrPay')
    const tPix = useTranslations('pix')
    const refusalMessage = usePixRefusalMessage(minimumBrl)
    const toFriendlyError = useFriendlyError()
    const queryClient = useQueryClient()
    const { fetchUser } = useAuth()
    const { sendTransactions } = useWallet()
    const [intentId, setIntentId] = useQueryState('intentId', parseAsString)
    // the QR flow's analytics: the same events as Manteca's QR attempts, with the route's provider
    const telemetryProvider = provider ?? undefined
    const attempt = useRef<QrPaymentAttemptTelemetry | null>(null)

    /** The line for a refusal of the review or the open, by wire code (API-CONTRACT-M4 §3). */
    const payRefusalMessage = useCallback(
        (caught: unknown, amountFixed: boolean): string => {
            switch (wireErrorCode(caught)) {
                case QR_INIT_CODE.DECODE:
                case API_ERROR_CODES.PAYMENT_DESTINATION_NOT_FOUND:
                    return t('errors.pixDecode')
                case QR_INIT_CODE.PIX_RECURRING:
                    return t('errors.pixRecurring')
                case API_ERROR_CODES.PIX_KEY_BLOCKED:
                    return t('errors.merchantNotAvailable')
                case API_ERROR_CODES.PIX_LIMIT_EXCEEDED:
                    return t(amountFixed ? 'errors.monthlyCapReachedFixedAmount' : 'errors.monthlyCapReached')
                case API_ERROR_CODES.PIX_MIN_AMOUNT:
                case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
                case API_ERROR_CODES.PIX_QUOTE_EXPIRED:
                case API_ERROR_CODES.PROVIDER_REJECTED:
                    return refusalMessage(caught)
                default:
                    return tPix('unavailable')
            }
        },
        [t, tPix, refusalMessage]
    )

    // ---- the review --------------------------------------------------------------------------
    const codeRead = useQuery({
        queryKey: ['pix-pay-preview', brCode],
        queryFn: () => pixApi.previewPayment({ brCode }),
        enabled: enabled && canStart && !intentId,
        // a wire code is the API's verdict on this code; only a transport failure is worth a retry
        retry: (count, caught) => !wireErrorCode(caught) && count < 2,
        staleTime: Infinity,
    })
    const openAmount = wireErrorCode(codeRead.error) === QR_INIT_CODE.MISSING_AMOUNT
    useEffect(() => {
        if (codeRead.status === 'pending') return
        // a code without its own amount is ready: the reais typed are reviewed next
        const outcome =
            codeRead.status === 'success' || openAmount
                ? 'ready'
                : wireErrorCode(codeRead.error)
                  ? 'refused'
                  : 'unavailable'
        trackPixQrInitResult(pixQrHost(brCode), outcome, telemetryProvider)
    }, [codeRead.status, codeRead.error, openAmount, brCode, telemetryProvider])
    const amountFixed = !!codeRead.data?.amountFixed

    const typedBrl = openAmount ? toApiDecimal(amountBrl ?? '', 2) : null
    const typedUnderMinimum = openAmount && isUnderPixMinimum(amountBrl, minimumBrl)
    const quotedBrl = useDebounce(typedUnderMinimum ? null : typedBrl, 500)
    const amountRead = useQuery({
        queryKey: ['pix-pay-preview', brCode, quotedBrl],
        queryFn: () => pixApi.previewPayment({ brCode, amountBrl: quotedBrl! }),
        enabled: enabled && canStart && !intentId && openAmount && !!quotedBrl,
        retry: (count, caught) => !wireErrorCode(caught) && count < 2,
        staleTime: 30_000,
    })
    // a code with its own amount answers the other amount with this: read it again without one
    const { refetch: readCodeAgain } = codeRead
    useEffect(() => {
        if (wireErrorCode(amountRead.error) === API_ERROR_CODES.PIX_QR_AMOUNT_FIXED) void readCodeAgain()
    }, [amountRead.error, readCodeAgain])

    // An open whose fresh figures moved against the user is held, unsigned, and its figures replace
    // the review's: the next tap signs exactly that payment, never figures the screen did not show.
    const [held, setHeld] = useState<PixPayOpened | null>(null)
    const reviewed: PixPayDisplay | null = useMemo(() => {
        const read = openAmount ? (quotedBrl === typedBrl ? (amountRead.data ?? null) : null) : (codeRead.data ?? null)
        if (!read) return null
        if (held && held.display.amountBrl === read.amountBrl) return held.display
        return read
    }, [openAmount, quotedBrl, typedBrl, amountRead.data, codeRead.data, held])

    // Who is paid, from the last read that named them: a code without an amount names nobody until
    // the reais typed are reviewed, and a new amount must not blank the card while it is quoted.
    const [lastNamed, setLastNamed] = useState<PixPayDisplay | null>(null)
    useEffect(() => {
        if (reviewed) setLastNamed(reviewed)
    }, [reviewed])
    const merchant = reviewed ?? lastNamed

    const codeRefusal = codeRead.error && !openAmount ? payRefusalMessage(codeRead.error, true) : null
    const amountRefusal = amountRead.error ? payRefusalMessage(amountRead.error, false) : null

    // ---- the payment ---------------------------------------------------------------------------
    const [phase, setPhase] = useState<PayPhase>('idle')
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    // a lapsed quote needs a payment of its own: a new key (API-CONTRACT-M4 §2.2)
    const [keyGeneration, setKeyGeneration] = useState(0)
    const latestPhase = useRef<PayPhase>('idle')
    const moveTo = useCallback((next: PayPhase) => {
        latestPhase.current = next
        setPhase(next)
    }, [])
    useEffect(() => {
        setError(null)
        setNotice(null)
        setHeld(null)
    }, [typedBrl])

    const { mutateAsync: sendDeposit } = useMutation({
        mutationKey: [BALANCE_DECREASE, PIX_PAY],
        // a second send of the same deposit could pay twice
        retry: false,
        mutationFn: ({ request, amount }: { request: DepositWithIdSign; amount: bigint }) =>
            sendTransactions(
                rhinoDepositWithIdCalls({
                    tokenAddress: request.tokenAddress as Address,
                    contractAddress: request.contractAddress as Address,
                    amount,
                    commitmentId: request.commitmentId,
                }),
                {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // the pay amount, so the card collateral covers what leaves
                    requiredUsdcAmount: amount,
                    kind: 'QR_PAY',
                }
            ),
    })

    const restartQuote = useCallback(() => {
        setKeyGeneration((generation) => generation + 1)
        setHeld(null)
        void queryClient.invalidateQueries({ queryKey: ['pix-pay-preview', brCode] })
    }, [queryClient, brCode])

    const open = useCallback(
        async (display: PixPayDisplay): Promise<PixPayOpened> => {
            const idempotencyKey = qrInitIdempotencyKey({
                qrCode: brCode,
                timestamp,
                amount: display.amountBrl,
                ...(keyGeneration > 0 ? { replacement: `pix-pay-${keyGeneration}` } : {}),
            })
            const request = {
                brCode,
                ...(display.amountFixed ? {} : { amountBrl: display.amountBrl }),
                maxSpendUsd: display.withdrawUsd,
                idempotencyKey,
            }
            for (let attempt = 0; ; attempt++) {
                try {
                    return await pixApi.openPayment(request)
                } catch (caught) {
                    // the first request still opens it: the same key answers once it has
                    if (wireErrorCode(caught) !== QR_INIT_CODE.IN_PROGRESS || attempt >= OPEN_IN_PROGRESS_RETRIES)
                        throw caught
                    await sleepUnlessCancelled(OPEN_IN_PROGRESS_WAIT_MS, () => false)
                }
            }
        },
        [brCode, timestamp, keyGeneration]
    )

    const pay = useCallback(async () => {
        const display = reviewed
        if (!display || latestPhase.current !== 'idle') return
        // the review never quotes under the minimum; nor does a tap
        if (isUnderPixMinimum(display.amountBrl, minimumBrl)) return
        setError(null)
        setNotice(null)
        moveTo('opening')
        const telemetry = createQrPaymentAttemptTelemetry({
            qrType: 'PIX',
            pixQrHost: pixQrHost(brCode),
            provider: telemetryProvider,
        })
        attempt.current = telemetry
        telemetry.stage('pay_clicked')
        const finish = (outcome: QrPaymentStageOutcome) => {
            telemetry.stage('attempt_finished', { outcome })
            attempt.current = null
        }
        // the payment held for the figures now on screen is signed as it is; anything else opens
        const holding = held && held.display === display ? held : null
        setHeld(null)
        let opened: PixPayOpened
        try {
            opened = holding ?? (await open(display))
        } catch (caught) {
            const code = wireErrorCode(caught)
            telemetry.stage('lock_ready', { outcome: 'failed', ...(code ? { failureCode: code } : {}) })
            finish('failed')
            moveTo('idle')
            if (code === API_ERROR_CODES.PIX_PAYMENT_EXISTS) {
                // past its signature: this payment is read, never signed again
                const existing = caught instanceof ApiError ? caught.intentId : undefined
                if (existing) {
                    moveTo('unconfirmed')
                    void setIntentId(existing)
                    return
                }
            }
            if (code === API_ERROR_CODES.PIX_QUOTE_CHANGED) {
                // nothing was opened: the review is quoted again and shows the new figures, under the
                // line a withdrawal and a key send show for the same answer (API-CONTRACT-M5 §2)
                void queryClient.invalidateQueries({ queryKey: ['pix-pay-preview', brCode] })
                setError(tPix('withdraw.errors.quoteChanged'))
                return
            }
            if (code === API_ERROR_CODES.PIX_QUOTE_EXPIRED) restartQuote()
            if (code === API_ERROR_CODES.ROUTE_NOT_AVAILABLE || code === API_ERROR_CODES.PROVIDER_UNAVAILABLE) {
                // the route moved since the screen loaded: the capabilities say where the user stands now
                void fetchUser().catch(() => undefined)
            }
            if (!code) void captureNetworkTriagedFailure(caught, { tags: flowTags('open') })
            setError(payRefusalMessage(caught, display.amountFixed))
            return
        }

        const { sign } = opened
        // The wallet only ever spends its own USDC, for exactly the USD the user is shown, on one bridge.
        if (
            sign.kind !== 'deposit-with-id' ||
            !areEvmAddressesEqual(sign.tokenAddress, PEANUT_WALLET_TOKEN) ||
            !signMatchesDisplay(opened.display, sign)
        ) {
            Sentry.captureException(new Error('Pix QR payment sign request off-contract'), {
                tags: flowTags('sign-request'),
                extra: { intentId: opened.intentId, kind: sign.kind },
            })
            telemetry.stage('lock_ready', { outcome: 'failed' })
            finish('failed')
            moveTo('idle')
            setError(tPix('unavailable'))
            return
        }
        telemetry.stage('lock_ready', { outcome: 'success' })
        if (!holding && quoteMovedAgainstUser(display, opened.display)) {
            // nothing is signed until the user taps Pay on the new figures
            finish('cancelled')
            setHeld(opened)
            setNotice(t('reviewUpdatedQuote'))
            moveTo('idle')
            return
        }
        // the bridge quote lives minutes; a deposit on an expired commitment is not bridged
        if (!(Date.parse(sign.quoteExpiresAt) > Date.now())) {
            finish('failed')
            restartQuote()
            moveTo('idle')
            setError(tPix('withdraw.errors.quoteExpired'))
            return
        }

        moveTo('signing')
        // From here a deposit may leave the wallet. The URL names the payment, so a reload reads it
        // instead of offering Pay again, and the device mark says it may have been sent.
        markDepositMaybeSent(opened.intentId)
        void setIntentId(opened.intentId)
        let minedHash: string | undefined
        let reverted = false
        try {
            const result = await sendDeposit({ request: sign, amount: BigInt(sign.payAmountUnits) })
            if (result.receipt && isTxReverted(result.receipt)) {
                reverted = true
                throw new Error(`Transaction failed (reverted). Hash: ${result.receipt.transactionHash}`)
            }
            minedHash = result.receipt?.transactionHash
        } catch (caught) {
            // A dismissed passkey or a reverted transaction moved nothing: Pay opens the same payment
            // again (same key) and signs it. Any other failure may have sent it: the read decides.
            if (reverted || isUserCancellation(caught)) {
                const cancelled = !reverted && isUserCancellation(caught)
                telemetry.stage('signature_ready', { outcome: cancelled ? 'cancelled' : 'failed' })
                finish(cancelled ? 'cancelled' : 'failed')
                clearDepositMaybeSent(opened.intentId)
                void setIntentId(null)
                moveTo('idle')
                setError(isUserCancellation(caught) ? t('errors.confirmTransaction') : t('errors.signFailed'))
                return
            }
            void captureNetworkTriagedFailure(caught, { tags: flowTags('sign'), extra: { intentId: opened.intentId } })
            // it may have been sent: the read's outcome finishes the attempt
            telemetry.stage('signature_ready', { outcome: 'unknown' })
            moveTo('unconfirmed')
            setError(toFriendlyError(caught))
            return
        }
        telemetry.stage('signature_ready', { outcome: 'success' })
        if (minedHash) telemetry.stage('request_sent')
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        void queryClient.invalidateQueries({ queryKey: ['balance'] })
        moveTo(minedHash ? 'sent' : 'unconfirmed')
        if (minedHash) {
            // optional for the money: the provider's events move it either way; the retry guard reads it
            pixApi.reportPaymentFunding(opened.intentId, minedHash).catch((caught) => {
                Sentry.captureException(caught, {
                    tags: flowTags('report-funding'),
                    extra: { intentId: opened.intentId },
                })
            })
        }
    }, [
        reviewed,
        held,
        minimumBrl,
        telemetryProvider,
        moveTo,
        open,
        setIntentId,
        queryClient,
        brCode,
        t,
        tPix,
        restartQuote,
        fetchUser,
        payRefusalMessage,
        sendDeposit,
        toFriendlyError,
    ])

    // ---- the outcome ---------------------------------------------------------------------------
    const signedHere = phase === 'sent' || phase === 'unconfirmed'
    const mayHaveSent = signedHere || (!!intentId && depositMaybeSent(intentId))
    const read = useQuery({
        queryKey: ['pix-pay', intentId],
        queryFn: () => pixApi.readPayment(intentId!),
        enabled: enabled && !!intentId && phase !== 'opening' && phase !== 'signing',
        refetchInterval: (query) => {
            const state = query.state.data?.state
            if (state && TERMINAL_STATES.has(state)) return false
            // a payment never signed here lapses on its own; nothing to wait for
            if (state === 'awaiting_signature' && !mayHaveSent) return false
            return READ_POLL_MS
        },
    })
    const outcome = intentId ? pixPayOutcome(read.data, { mayHaveSent }) : null
    useEffect(() => {
        if (outcome && outcome !== 'processing') void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [outcome, queryClient])
    // an attempt signed in this session ends with the payment's outcome
    useEffect(() => {
        const telemetry = attempt.current
        if (!telemetry || !outcome || outcome === 'processing') return
        telemetry.stage('response_received', { outcome: ATTEMPT_OUTCOME[outcome] })
        if (outcome === 'paid') telemetry.stage('success_committed', { outcome: 'success' })
        telemetry.stage('attempt_finished', { outcome: ATTEMPT_OUTCOME[outcome] })
        attempt.current = null
    }, [outcome])

    // The reward is issued on completion, so a paid read may name none yet: it is read once more
    // (API-CONTRACT-M5 §3). The mark is set when the read goes out, so a remount does not lose it.
    const rereadForReward = useRef<string | null>(null)
    const { refetch: readAgain } = read
    const paidWithoutReward = read.data?.state === 'paid' && read.data.perk === null
    useEffect(() => {
        if (!paidWithoutReward || !intentId || rereadForReward.current === intentId) return
        const timer = setTimeout(() => {
            rereadForReward.current = intentId
            void readAgain()
        }, READ_POLL_MS)
        return () => clearTimeout(timer)
    }, [paidWithoutReward, intentId, readAgain])

    // the processing screen lasts the quoted arrival time; a payment still open then reads as processing
    const arrivalMs = (reviewed?.arrivalEstimateSeconds ?? FALLBACK_ARRIVAL_SECONDS) * 1000
    const [pastArrival, setPastArrival] = useState(false)
    useEffect(() => {
        if (outcome !== 'processing') return
        const timer = setTimeout(() => setPastArrival(true), arrivalMs)
        return () => clearTimeout(timer)
    }, [outcome, arrivalMs])

    return {
        /** The figures on screen: the code's read, or the read of the reais typed. */
        reviewed,
        /** Who is paid (name, bank, tax id), from the last read that named them. */
        merchant,
        /** Null until the code's first read answers. */
        amountFixed: codeRead.data ? amountFixed : openAmount ? false : null,
        isReadingCode: codeRead.isLoading,
        isQuotingAmount:
            openAmount && !!typedBrl && !typedUnderMinimum && (quotedBrl !== typedBrl || amountRead.isFetching),
        /** The code cannot be paid: its read was refused. */
        codeRefusal,
        /** The typed amount was refused (the provider's minimum, the monthly limit). */
        amountRefusal,
        phase,
        error,
        notice,
        intentId,
        payment: read.data,
        outcome,
        /** The processing screen has waited the quoted arrival time. */
        pastArrival,
        pay,
    }
}
