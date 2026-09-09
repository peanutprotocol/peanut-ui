'use client'

import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { parseUnits } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useSafeBack } from '@/hooks/useSafeBack'
import { mantecaApi } from '@/services/manteca'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { useStaleSessionGuard } from '@/hooks/wallet/useStaleSessionGuard'
import { SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { friendlyError } from '@/utils/friendly-error.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainCentsToUsdcUnits, isAmountWithinBalance } from '@/utils/balance.utils'
import { qrInitIdempotencyKey } from '@/utils/qr-payment.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { MANTECA_QR_DEPOSIT_ADDRESS_AR, MANTECA_QR_DEPOSIT_ADDRESS_NON_AR } from '@/constants/manteca.consts'
import { pickMantecaDepositAddress } from '@/utils/manteca.utils'
import { MANTECA_QR_INIT_SCAN_TIMEOUT_MS } from '@/constants/manteca.consts'
import { MIN_MANTECA_QR_PAYMENT_AMOUNT, MIN_PIX_AMOUNT_BRL } from '@/constants/payment.consts'
import { isPixRecurringCode } from '@/utils/withdraw.utils'
import { loadingStateContext } from '@/context/loadingStates.context'
import { getCurrencyPrice } from '@/app/actions/currency'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isPaymentProcessorQR, EQrType, NAME_BY_QR_TYPE, type QrType } from '@/components/Global/DirectSendQR/utils'
import { useAuth } from '@/context/authContext'
import { PointsAction } from '@/services/services.types'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { useAppReviewNudge } from '@/hooks/useAppReviewNudge'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import maintenanceConfig from '@/config/underMaintenance.config'
import { TRANSACTIONS } from '@/constants/query.consts'
import {
    classifyQrInitError,
    classifyScanOutcome,
    isNonRetryableQrInitError,
    QR_INIT_CODE,
} from './init-error-classifier'
import { useQrFailureCopy } from './useQrFailureCopy'
import { useQrPayKycGate } from './useQrPayKycGate'
import { deriveQrPayView } from './derive-view'
import type { QrPayFlowBag, QrPayScanParams } from './qr-pay-flow.types'

const MAX_QR_PAYMENT_AMOUNT = '2000'
const MIN_QR_PAYMENT_AMOUNT = '0.1'

type PaymentProcessor = 'MANTECA'

/**
 * All qr-pay behavior: the payment-lock query, scan-outcome classification,
 * currency and amount seeding, payment execution, and the derived view. Called
 * exactly ONCE, by `QrPayFlowProvider` — effects here must never run per-view.
 * Views read the result through `useQrPayFlow()`.
 */
export function useQrPayFlowController(bag: QrPayFlowBag, scan: QrPayScanParams) {
    const { qrCode, timestamp, qrType } = scan
    const t = useAppTranslations('qrPay')
    const tErrors = useTranslations('errors')
    const toFriendlyError = useFriendlyError()
    const router = useRouter()
    // QR-pay screens are terminal — leaving /qr-pay in history would let browser back from
    // /home pop the user back into a stale error / KYC screen. Replace instead of push.
    const onBack = useSafeBack('/home', { replace: true })

    // Rail name for outage copy. Defined here rather than reusing
    // `paymentMethodName` below because the failure-copy maps need it.
    const qrMethodName = (qrType && NAME_BY_QR_TYPE[qrType as QrType]) || 'QR'
    const { scanFailureCopy, amountEntryFailureCopy, pixRecurringErrorMessage } = useQrFailureCopy(qrType, qrMethodName)

    /*
     * Stable across this scan's four attempts, so a retry after a timeout
     * replays the price lock the first attempt may already have created rather
     * than minting a second one at Manteca.
     */
    const scanIdempotencyKey = useMemo(() => qrInitIdempotencyKey({ qrCode, timestamp }), [qrCode, timestamp])

    const { spendableBalance: balance } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const handleStaleSession = useStaleSessionGuard()
    const { overview: rainCardOverview } = useRainCardOverview()
    const { user } = useAuth()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const queryClient = useQueryClient()

    const {
        isSuccess,
        setIsSuccess,
        errorMessage,
        errorCode,
        setErrorMessage,
        paymentLock,
        setPaymentLock,
        qrPayment,
        setQrPayment,
        amount,
        setAmount,
        currencyAmount,
        setCurrencyAmount,
        currency,
        setCurrency,
        showOrderNotReadyModal,
        setShowOrderNotReadyModal,
        waitingForMerchantAmount,
        setWaitingForMerchantAmount,
    } = bag

    const paymentProcessor: PaymentProcessor | null = useMemo(() => {
        switch (qrType) {
            case EQrType.MERCADO_PAGO:
            case EQrType.ARGENTINA_QR3:
            case EQrType.PIX:
                return 'MANTECA'
            default:
                return null
        }
    }, [qrType])
    const targetMantecaCountry = useMemo(() => {
        switch (qrType) {
            case EQrType.PIX:
                return 'BR'
            case EQrType.MERCADO_PAGO:
            case EQrType.ARGENTINA_QR3:
                return 'AR'
            default:
                return undefined
        }
    }, [qrType])

    // Check if this payment provider is under maintenance
    const isProviderDisabled = useMemo(() => {
        return paymentProcessor ? maintenanceConfig.disabledPaymentProviders.includes(paymentProcessor) : false
    }, [paymentProcessor])

    const gate = useQrPayKycGate()
    const { kycGateState, shouldBlockPay } = gate

    /*
     * Refusals decided BEFORE the query runs (recurring Pix, unparseable QR).
     * Pure derivations of the scan itself — the old page latched them into
     * state from a reset effect; a new scan now remounts the provider instead.
     * Recurrence codes can match PIX_REGEX, so that check runs first: the
     * specific message must win over the generic "Invalid QR code scanned".
     */
    const entryGuardError = useMemo(() => {
        if (qrCode && isPixRecurringCode(qrCode)) return pixRecurringErrorMessage
        if (!qrCode || !isPaymentProcessorQR(qrCode)) return t('errors.invalidQr')
        return null
    }, [qrCode, pixRecurringErrorMessage, t])

    // Get amount from payment lock (Manteca)
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return
        if (!paymentLock) return
        if (paymentLock.code !== '') {
            // For dynamic QR codes with preset amounts:
            // paymentAssetAmount is in local currency (e.g., "92" BRL)
            // paymentAgainstAmount is the USD equivalent (e.g., "18.4" USD)
            // AmountInput expects tokenValue in USD, so we pass paymentAgainstAmount
            // It will convert to local currency for display using isInitialInputUsd=false
            setAmount(paymentLock.paymentAgainstAmount)
            setCurrencyAmount(paymentLock.paymentAssetAmount)
        }
    }, [paymentLock, paymentProcessor, setAmount, setCurrencyAmount])

    // Get currency object from payment lock (Manteca)
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return
        if (!paymentLock) return
        // Guard the async set: without it a route change mid-fetch writes state
        // into an unmounted flow (and a StrictMode remount double-writes).
        let cancelled = false
        const getCurrencyObject = async () => {
            let currencyCode: string
            let price: number
            currencyCode = paymentLock.paymentAsset
            if (paymentLock.code === '') {
                price = (await getCurrencyPrice(currencyCode)).sell
            } else {
                price = Number(paymentLock.paymentPrice)
            }
            return {
                code: currencyCode,
                symbol: currencyCode,
                price,
            }
        }
        getCurrencyObject().then((currencyObject) => {
            if (!cancelled) setCurrency(currencyObject)
        })
        return () => {
            cancelled = true
        }
    }, [paymentLock, paymentProcessor, setCurrency])

    const isBlockingError = useMemo(() => {
        // The settling failure says "try again in a few seconds" — keep the Pay
        // button enabled so the user can retry, don't dead-end it like a hard error.
        return (
            !!errorMessage &&
            errorCode !== 'confirmTransaction' &&
            errorCode !== 'balanceSettling' &&
            // A rejection the user can clear by typing a different amount.
            errorCode !== 'amountRetryable'
        )
    }, [errorMessage, errorCode])

    const usdAmount = useMemo(() => {
        if (!paymentLock) return null
        if (paymentLock.code === '') {
            // For static QR codes (user inputs amount), convert from local currency to USD
            // currencyAmount is in local currency (ARS, BRL), amount is the USD equivalent
            return amount
        } else {
            // For dynamic QR codes, backend provides the USD amount
            return paymentLock.paymentAgainstAmount
        }
    }, [paymentLock, amount])

    // Fetch points early to avoid latency penalty - fetch as soon as we have usdAmount
    // This way points are cached by the time success view shows
    // Use timestamp as uniqueId to prevent cache collisions between different QR scans
    const { pointsData, pointsDivRef } = usePointsCalculation(
        PointsAction.MANTECA_QR_PAYMENT,
        usdAmount,
        paymentProcessor === 'MANTECA',
        timestamp || undefined
    )

    const methodIcon = useMemo(() => {
        switch (qrType) {
            case EQrType.MERCADO_PAGO:
                return MERCADO_PAGO
            case EQrType.ARGENTINA_QR3:
                return getFlagUrl('ar')
            case EQrType.PIX:
                return PIX
            default:
                return null
        }
    }, [qrType])

    // Fetch Manteca payment lock immediately on QR scan (Manteca only)
    // OPTIMIZATION: We fetch payment details BEFORE KYC check completes for faster UX
    // This is SAFE because:
    // 1. We only fetch payment metadata (merchant info, amount) - no sensitive action
    // 2. The actual payment action is blocked by shouldBlockPay
    // 3. KYC modals are shown if needed before user can pay
    // This reduces latency from 4-5s to <1s for KYC'd users
    //
    // NETWORK RESILIENCE: retryable failures get three more attempts, 3s apart
    // - Four attempts total, not three: `failureCount` is 0-based where
    //   react-query consults it, so `failureCount < 3` permits three retries.
    //   The delay is flat, not exponential — `retryDelay` is a constant 3000.
    // - Provider-specific errors (e.g., "can't decode") are NOT retried
    // - Prevents state updates on unmounted component
    // Fetch Manteca payment lock with TanStack Query - handles retries, caching, and loading states
    const {
        data: fetchedPaymentLock,
        isLoading: isLoadingPaymentLock,
        error: paymentLockError,
        failureReason: paymentLockFailureReason,
        fetchStatus: paymentLockFetchStatus,
        refetch: refetchPaymentLock,
    } = useQuery({
        queryKey: ['manteca-payment-lock', qrCode, timestamp],
        queryFn: async () => {
            if (paymentProcessor !== 'MANTECA' || !qrCode || !isPaymentProcessorQR(qrCode)) {
                return null
            }
            return mantecaApi.initiateQrPayment(
                { qrCode, qrType: qrType ?? undefined, idempotencyKey: scanIdempotencyKey },
                { timeoutMs: MANTECA_QR_INIT_SCAN_TIMEOUT_MS }
            )
        },
        enabled:
            paymentProcessor === 'MANTECA' &&
            !!qrCode &&
            isPaymentProcessorQR(qrCode) &&
            // Composite Automático codes also match isPaymentProcessorQR — without
            // this the entry guard shows its error but the doomed init still fires.
            !isPixRecurringCode(qrCode) &&
            !paymentLock &&
            !shouldBlockPay &&
            // The maintenance kill-switch is render-only below; without this the
            // doomed /init still fires on every scan during a provider outage.
            !isProviderDisabled,
        retry: (failureCount, error) => {
            /*
             * One predicate over one table (`init-error-classifier`), reading
             * the wire code with an allow-listed prose fallback. The retry gate
             * and the copy mapping can no longer disagree about which refusals
             * are deterministic — a drift that previously let a reworded
             * rejection schedule three more POSTs behind the correct copy.
             */
            if (isNonRetryableQrInitError(error)) return false
            // Three retries on top of the first attempt (see the note above).
            return failureCount < 3
        },
        retryDelay: 3000,
        staleTime: 0, // Always fetch fresh data
        gcTime: 0, // Don't cache for garbage collection
    })

    /*
     * What the scan screen is showing, DERIVED from the query instead of
     * latched into state by an effect.
     *
     * The previous version wrote three pieces of state from a nine-branch
     * if/else ladder, and every defect this screen accumulated was a
     * consequence: an error that outlived its cause (a recovered scan stuck
     * behind a stale outage message), a caption with no exit (an offline pause
     * that never settles), and branch ordering that had to be re-derived by
     * hand each time a case was added. `classifyScanOutcome` checks the lock
     * first and unconditionally, so those are no longer reachable states rather
     * than bugs to be re-fixed.
     */
    const scanOutcome = useMemo(
        () =>
            classifyScanOutcome({
                hasLock: !!paymentLock || !!fetchedPaymentLock,
                settledError: paymentLockError,
                failureReason: paymentLockFailureReason,
                fetchStatus: paymentLockFetchStatus,
            }),
        [paymentLock, fetchedPaymentLock, paymentLockError, paymentLockFailureReason, paymentLockFetchStatus]
    )

    /*
     * The guard wins: it fires before the query is even enabled, and its
     * verdicts (a recurring Pix code, an unparseable QR) are terminal.
     */
    const errorInitiatingPayment = useMemo(
        () => entryGuardError ?? (scanOutcome.kind === 'failed' ? scanFailureCopy[scanOutcome.reason] : null),
        [entryGuardError, scanOutcome, scanFailureCopy]
    )

    // Side effects only. Everything the screen RENDERS is derived above.
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return

        if (fetchedPaymentLock && !paymentLock) setPaymentLock(fetchedPaymentLock)

        if (scanOutcome.kind === 'awaiting-merchant-amount') setWaitingForMerchantAmount(true)
        else if (scanOutcome.kind !== 'pending' && scanOutcome.kind !== 'idle') setWaitingForMerchantAmount(false)

        /*
         * `idle` deliberately touches nothing. A disabled query — invalid QR,
         * KYC-blocked user, provider maintenance — must not drive the app-wide
         * loading context, which survives navigation away from this route.
         */
        if (scanOutcome.kind === 'pending') setLoadingState('Fetching details')
        else if (scanOutcome.kind === 'retrying') setLoadingState('Still fetching details')
        else if (scanOutcome.kind !== 'idle') setLoadingState('Idle')

        if (scanOutcome.kind === 'failed') {
            if (scanOutcome.reason === QR_INIT_CODE.DECODE) {
                posthog.capture(ANALYTICS_EVENTS.QR_DECODING_ERROR_SHOWN, { qr_type: qrType })
            } else if (scanOutcome.reason === QR_INIT_CODE.EXPIRED) {
                posthog.capture(ANALYTICS_EVENTS.QR_MERCHANT_CHARGE_EXPIRED_SHOWN, { qr_type: qrType })
            }
        }
    }, [
        scanOutcome,
        fetchedPaymentLock,
        paymentLock,
        paymentProcessor,
        qrType,
        setLoadingState,
        setPaymentLock,
        setWaitingForMerchantAmount,
    ])

    /*
     * The loading context is app-wide and outlives this route, so leaving it set
     * on the way out locks the send/request handlers, which read `isLoading` as
     * a hard gate. Nothing on this page needs it once the page is gone.
     */
    useEffect(() => {
        return () => setLoadingState('Idle')
    }, [setLoadingState])

    useEffect(() => {
        if (isSuccess || !!errorMessage) {
            setLoadingState('Idle')
        }
    }, [isSuccess, errorMessage, setLoadingState])

    // Reopening the app onto a past QR URL (last merchant, expired lock) is stale —
    // after a real absence, drop the user on home so they can start fresh.
    useEffect(() => {
        const STALE_THRESHOLD_MS = 30_000
        let hiddenAt: number | null = null

        const onVisibility = () => {
            if (document.hidden) {
                hiddenAt = Date.now()
                return
            }
            if (hiddenAt === null) return
            const elapsed = Date.now() - hiddenAt
            hiddenAt = null
            if (elapsed > STALE_THRESHOLD_MS) {
                router.push('/home')
            }
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [router])

    /*
     * Editing the amount clears the last init error. A cap or Pix-minimum
     * rejection is about the amount, so leaving its message on screen next to a
     * new number states something no longer known to be true — and the stale
     * `amountRetryable` code would outlive the error it was set for.
     */
    const handleCurrencyAmountChange = useCallback(
        (value: string) => {
            setCurrencyAmount(value)
            /*
             * Only the amount-shaped rejections. Clearing unconditionally
             * un-blocked TERMINAL ones too — an unfinished KYC or a merchant
             * refund block re-enabled Pay on any keystroke, letting the user
             * re-POST a rejection no amount can change and minting another
             * Manteca price lock on the refund path.
             */
            if (errorCode === 'amountRetryable') setErrorMessage(null)
        },
        [errorCode, setErrorMessage, setCurrencyAmount]
    )

    const merchantName = useMemo(() => {
        if (!paymentLock) return null
        return paymentLock.paymentRecipientName
    }, [paymentLock])

    // The "paying" caption timer must die with the flow: the loading context is
    // app-wide, so a timer surviving unmount would flip it back to 'Paying'
    // after the route already reset it to Idle.
    const payingStateTimerRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        return () => {
            if (payingStateTimerRef.current) clearTimeout(payingStateTimerRef.current)
        }
    }, [])

    const handleMantecaPayment = useCallback(async () => {
        if (!paymentLock || !qrCode || !currencyAmount) return

        let finalPaymentLock = paymentLock
        if (finalPaymentLock.code === '') {
            setLoadingState('Fetching details')
            try {
                finalPaymentLock = await mantecaApi.initiateQrPayment({
                    qrCode,
                    amount: currencyAmount,
                    qrType: qrType ?? undefined,
                    // The amount is part of the identity: a different number is
                    // a genuinely different lock, so it must not replay the last one.
                    idempotencyKey: qrInitIdempotencyKey({ qrCode, timestamp, amount: currencyAmount }),
                })
                setPaymentLock(finalPaymentLock)
            } catch (error) {
                /*
                 * An open-amount QR only learns its cap verdict HERE: the scan
                 * returned a lock with an empty code, and the amount the user
                 * just typed is what the backend measures against the remaining
                 * headroom. Routing that to "unexpected error" threw away the
                 * one screen that could tell them to try a smaller amount.
                 */
                const deterministic = classifyQrInitError(error, 'amount-entry')
                if (deterministic) {
                    // Deterministic rejection — actionable copy, not a
                    // Sentry-worthy surprise.
                    /*
                     * A cap or Pix-minimum rejection names the AMOUNT as the
                     * problem and the copy tells the user to try another one.
                     * Without the code `isBlockingError` stays true and Pay is
                     * disabled for the rest of the scan, so the advice could not
                     * be followed — the same dead end `balanceSettling` exists
                     * to avoid.
                     */
                    setErrorMessage(
                        amountEntryFailureCopy[deterministic.code] ?? scanFailureCopy[deterministic.code],
                        deterministic.amountRetryable ? 'amountRetryable' : null
                    )
                } else {
                    void captureNetworkTriagedFailure(error, {
                        tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'initiate' },
                    })
                    setErrorMessage(t('errors.initiateUnexpected'))
                }
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
        }
        if (finalPaymentLock.code === '') {
            setErrorMessage(t('errors.fetchDetails'))
            setIsSuccess(false)
            setLoadingState('Idle')
            return
        }

        setLoadingState('Preparing transaction')
        // Route across smart-only / mixed / collateral-only — pure-collateral
        // payments (smart wallet empty, card collateral covers it) used to fail
        // here because ZeroDev's paymaster simulated a USDC transfer from a
        // zero-balance smart account and refused to sponsor. The signSpend
        // hook now picks the right routing, including a single-tap
        // collateral-only path that lets Rain transfer straight from the
        // collateral proxy to MANTECA's deposit address.
        let signedArtifact
        try {
            const requiredUsdcAmount = parseUnits(finalPaymentLock.paymentAgainstAmount, PEANUT_WALLET_TOKEN_DECIMALS)
            signedArtifact = await signSpend({
                requiredUsdcAmount,
                // Entity-aware deposit address served by the API (per-entity
                // balances from 2026-09-14) — the backend resolves the entity
                // from the QR and the paying Manteca account. The per-rail
                // constants remain only as a fallback for an older API that
                // does not return the field yet.
                recipient: pickMantecaDepositAddress(
                    finalPaymentLock.depositAddress,
                    qrType === EQrType.PIX ? MANTECA_QR_DEPOSIT_ADDRESS_NON_AR : MANTECA_QR_DEPOSIT_ADDRESS_AR
                ),
                rainSpendingPower: rainCentsToUsdcUnits(rainCardOverview?.balance?.spendingPower),
                kind: 'QR_PAY',
            })
        } catch (error) {
            // Route through the shared classifier so backend wire codes reach this
            // screen too; the two branches ahead of it are deliberately per-flow.
            const classified = friendlyError(error)
            if (error instanceof SessionKeyGrantRequiredError) {
                setErrorMessage(t('errors.cardAuthNeeded'))
            } else if ((error as Error).toString().includes('not allowed')) {
                // Looser than the classifier's 'not allowed by the user agent';
                // kept as-is so this screen's matching doesn't narrow.
                setErrorMessage(t('errors.confirmTransaction'), 'confirmTransaction')
            } else if (classified.kind === 'code' && classified.code === 'genericSupport') {
                // Keep the flow-specific fallback — "couldn't sign" beats the
                // generic support copy on a signing failure — and the Sentry report.
                void captureNetworkTriagedFailure(error, {
                    tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'sign' },
                })
                setErrorMessage(t('errors.signFailed'))
            } else {
                // A classified error is normally a deliberate non-report (backend
                // wire code, or a user action). Network-layer failures are the
                // exception: once `connectionLost` existed they classified HERE
                // instead of genericSupport above, which silently ended their
                // Sentry reporting altogether (TASK-21956).
                if (isNetworkLayerFailure(error)) {
                    void captureNetworkTriagedFailure(error, {
                        tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'sign' },
                    })
                }
                setErrorMessage(toFriendlyError(error), classified.kind === 'text' ? null : classified.code)
            }
            setIsSuccess(false)
            setLoadingState('Idle')
            return
        }

        // Send signed artifact to backend for coordinated execution.
        // Backend creates the Manteca order FIRST, then either broadcasts the
        // signed UserOp (smart-only / mixed) or submits the Rain withdrawal via
        // the user's session-key UserOp (collateral-only).
        // Schedule "paying" state after 3s so the user sees something is happening.
        payingStateTimerRef.current = setTimeout(() => setLoadingState('Paying'), 3000)
        try {
            const requestBody =
                signedArtifact.strategy === 'collateral-only'
                    ? ({
                          kind: 'rainWithdrawal' as const,
                          paymentLockCode: finalPaymentLock.code,
                          qrType: qrType ?? undefined,
                          signedRainWithdrawal: signedArtifact.rainWithdrawal,
                          chainId: PEANUT_WALLET_CHAIN.id.toString(),
                      } as const)
                    : ({
                          kind: 'userOp' as const,
                          paymentLockCode: finalPaymentLock.code,
                          qrType: qrType ?? undefined,
                          signedUserOp: signedArtifact.signedUserOp.signedUserOp,
                          chainId: signedArtifact.signedUserOp.chainId,
                          entryPointAddress: signedArtifact.signedUserOp.entryPointAddress,
                          // For mixed: tell backend about the Rain prepare intent
                          // embedded in the UserOp's batched callData so it can
                          // reconcile the collateral webhook to QR_PAY in history.
                          ...(signedArtifact.strategy === 'mixed'
                              ? { rainPreparationId: signedArtifact.rainPreparationId }
                              : {}),
                      } as const)
            const qrPaymentResponse = await mantecaApi.completeQrPaymentWithSignedTx(requestBody)
            // clear the timer since we got a response
            if (payingStateTimerRef.current) {
                clearTimeout(payingStateTimerRef.current)
                payingStateTimerRef.current = null
            }
            // Map backend field name (sponsoredUsd) to frontend field name (amountSponsored)
            const perkResponse = qrPaymentResponse.perk as Record<string, unknown> | undefined
            if (qrPaymentResponse.perk && typeof perkResponse?.sponsoredUsd === 'number') {
                qrPaymentResponse.perk.amountSponsored = perkResponse.sponsoredUsd
            }

            setQrPayment(qrPaymentResponse)

            // all eligible perks go through hold-to-claim — no auto-claiming.
            // this ensures a consistent reward experience regardless of amount.

            setIsSuccess(true)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, {
                strategy: signedArtifact.strategy,
                kind: 'QR_PAY',
                flow: 'sign-only',
            })
        } catch (error) {
            // clear the timer on error to prevent race condition
            if (payingStateTimerRef.current) {
                clearTimeout(payingStateTimerRef.current)
                payingStateTimerRef.current = null
            }
            // Wrong-passkey session: backend rejected the signed UserOp with
            // AA24 / wapk. Unrecoverable without re-auth — force a clean logout.
            if (handleStaleSession(error)) return
            void captureNetworkTriagedFailure(error, {
                tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'submit' },
            })
            const errorMsg = (error as Error).message || 'Could not complete payment'

            // Handle specific error cases
            if (errorMsg.toLowerCase().includes('nonce')) {
                setErrorMessage(t('errors.accountStateChanged'))
            } else if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('stale')) {
                setErrorMessage(t('errors.sessionExpired'))
            } else if (qrType === EQrType.PIX) {
                setErrorMessage(t('errors.merchantNotSupported'))
            } else {
                setErrorMessage(t('errors.completeFailed'))
            }
            setIsSuccess(false)
        } finally {
            setLoadingState('Idle')
        }
    }, [
        paymentLock,
        signSpend,
        rainCardOverview,
        qrCode,
        currencyAmount,
        scanFailureCopy,
        amountEntryFailureCopy,
        timestamp,
        setLoadingState,
        qrType,
        handleStaleSession,
        t,
        toFriendlyError,
        setErrorMessage,
        setIsSuccess,
        setPaymentLock,
        setQrPayment,
    ])

    const payQR = useCallback(async () => {
        if (paymentProcessor === 'MANTECA') {
            await handleMantecaPayment()
        }
    }, [paymentProcessor, handleMantecaPayment])

    /*
     * Balance and floor/cap validation, derived — the old effect-and-state pair
     * could only ever restate these inputs.
     */
    const balanceErrorMessage = useMemo(() => {
        if (!usdAmount || usdAmount === '0.00' || isNaN(Number(usdAmount)) || balance === undefined) {
            return null
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)

        // Manteca-specific validation (PIX, MercadoPago, QR3)
        if (paymentProcessor === 'MANTECA') {
            if (paymentAmount < parseUnits(MIN_MANTECA_QR_PAYMENT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
                return t('errors.minMantecaAmount', { amount: MIN_MANTECA_QR_PAYMENT_AMOUNT })
            }
            // PIX rail enforces a 1 BRL minimum, stricter than the USD floor above
            if (currency?.code === 'BRL' && currencyAmount && parseFloat(currencyAmount) < MIN_PIX_AMOUNT_BRL) {
                return t('errors.minPixAmountBrl', { amount: MIN_PIX_AMOUNT_BRL })
            }
        }

        // Common validations for all payment processors
        if (paymentAmount > parseUnits(MAX_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            return t('errors.maxQrAmount', { amount: MAX_QR_PAYMENT_AMOUNT })
        }
        if (paymentAmount < parseUnits(MIN_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            return t('errors.minQrAmount', { amount: MIN_QR_PAYMENT_AMOUNT })
        }
        if (!isAmountWithinBalance(usdAmount, balance)) {
            // gate on the displayed total; an in-transit shortfall passes here and
            // fails late with the settling message at execution.
            return tErrors('notEnoughBalanceAddFunds')
        }
        return null
    }, [usdAmount, balance, paymentProcessor, currency?.code, currencyAmount, t, tErrors])

    // Use points confetti hook for animation - must be called unconditionally
    usePointsConfetti(isSuccess && pointsData?.estimatedPoints ? pointsData.estimatedPoints : undefined, pointsDivRef)

    useEffect(() => {
        if (isSuccess) {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [isSuccess, queryClient])

    // the success here is optimistic — a post-factum claim failure keeps the
    // user on this screen with an error, and that is not a moment to ask
    useAppReviewNudge(user?.user.userId, 'qr_payment_completed', isSuccess && !errorMessage)

    useEffect(() => {
        if (waitingForMerchantAmount && !isLoadingPaymentLock) {
            setWaitingForMerchantAmount(false)
            setShowOrderNotReadyModal(true)
        }
    }, [waitingForMerchantAmount, isLoadingPaymentLock, setWaitingForMerchantAmount, setShowOrderNotReadyModal])

    const retryOrderNotReady = useCallback(() => {
        // Merchant likely entered the amount on their POS between
        // scans, so a fresh fetch with the same URL succeeds.
        setShowOrderNotReadyModal(false)
        void refetchPaymentLock()
    }, [setShowOrderNotReadyModal, refetchPaymentLock])

    // get user-facing payment method name for maintenance screen
    const paymentMethodName = useMemo(() => {
        switch (qrType) {
            case EQrType.PIX:
                return 'PIX'
            case EQrType.MERCADO_PAGO:
                return 'Mercado Pago'
            case EQrType.ARGENTINA_QR3:
                return 'QR'
            default:
                return 'QR'
        }
    }, [qrType])

    // check if we're still loading payment data before showing anything
    const isLoadingPaymentData = (paymentProcessor === 'MANTECA' && !paymentLock) || !currency

    const view = deriveQrPayView({
        kycGateState,
        isProviderDisabled,
        errorInitiatingPayment,
        waitingForMerchantAmount,
        showOrderNotReadyModal,
        isLoadingPaymentData,
        loadingState,
        isSuccess,
        isManteca: paymentProcessor === 'MANTECA',
    })

    return {
        view,
        // scan identity
        qrCode,
        timestamp,
        qrType,
        paymentProcessor,
        targetMantecaCountry,
        methodIcon,
        paymentMethodName,
        // flow state
        paymentLock,
        qrPayment,
        setQrPayment,
        amount,
        setAmount,
        currencyAmount,
        currency,
        isSuccess,
        errorMessage,
        errorInitiatingPayment,
        isBlockingError,
        balanceErrorMessage,
        // the wallet's spendable balance, surfaced here so views read ONE flow
        // object instead of re-calling useWallet next to it
        balance,
        usdAmount,
        merchantName,
        // kyc gate
        gate,
        shouldBlockPay,
        // loading
        isLoading,
        loadingState,
        // points
        pointsData,
        pointsDivRef,
        // actions
        onBack,
        payQR,
        handleCurrencyAmountChange,
        retryOrderNotReady,
    }
}

export type QrPayFlowSurface = ReturnType<typeof useQrPayFlowController>
