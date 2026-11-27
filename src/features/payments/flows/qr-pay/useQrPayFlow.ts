'use client'

import { MutationResponseTimeoutError } from '@/utils/connection-timeout-error'
import { pixQrHost } from '@/utils/pix-qr-host'

import { isPixKeyNotFound, recipientBankNameOf, verifiedPixKeyLabel } from '@/utils/pix.utils'
import { usePixKeyOwner } from '@/hooks/usePixKeyOwner'
import { usePixKeySavePrompt } from './usePixKeySavePrompt'
import {
    isSpendRecoveryOutcome,
    SpendRecoveryAbortedError,
    SpendRecoveryQuoteReviewError,
    submitSignedSpend,
} from '@/hooks/wallet/signSpendRetry'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { qrPaymentDisplayStatus } from '@/utils/qr-payment.utils'

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { sleepUnlessCancelled } from '@/utils/cancellable-wait'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { isAddress, parseUnits } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import { mantecaApi } from '@/services/manteca'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle, type SignSpendProgressEvent } from '@/hooks/wallet/useSignSpendBundle'
import { useSmartSpendPreparation } from '@/hooks/wallet/useSmartSpendPreparation'
import { useRainControllerRepair } from '@/hooks/wallet/useRainControllerRepair'
import { useSignedSpendRecovery } from '@/hooks/wallet/useSignedSpendRecovery'
import { useStaleSessionGuard } from '@/hooks/wallet/useStaleSessionGuard'
import {
    InsufficientSpendableError,
    SessionKeyGrantRequiredError,
    type SpendStrategy,
} from '@/hooks/wallet/spendPreflight'
import { friendlyError } from '@/utils/friendly-error.utils'
import { isPasskeyBusyError, isPasskeyCleanupPendingError } from '@/utils/webauthn.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useCooldownRemaining } from '@/hooks/useCooldownRemaining'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainCentsToUsdcUnits, isAmountWithinBalance } from '@/utils/balance.utils'
import { qrInitIdempotencyKey } from '@/utils/qr-payment.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { MANTECA_QR_DEPOSIT_ADDRESS_AR, MANTECA_QR_DEPOSIT_ADDRESS_NON_AR } from '@/constants/manteca.consts'
import { pickMantecaDepositAddress } from '@/utils/manteca.utils'
import { MANTECA_QR_INIT_SCAN_TIMEOUT_MS } from '@/constants/manteca.consts'
import { MIN_MANTECA_QR_PAYMENT_AMOUNT, MIN_PIX_AMOUNT_BRL } from '@/constants/payment.consts'
import { isPixRecurringCode, isPixEmvcoQr } from '@/utils/withdraw.utils'
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
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { usePixPayBlock } from '@/features/pix/usePixPayBlock'
import { TRANSACTIONS } from '@/constants/query.consts'
import {
    classifyQrInitError,
    classifyScanOutcome,
    isNonRetryableQrInitError,
    QR_INIT_CODE,
    SUPPORT_ACTIONABLE_FAILURES,
} from './init-error-classifier'
import { useQrFailureCopy } from './useQrFailureCopy'
import { useQrPayKycGate } from './useQrPayKycGate'
import { deriveQrPayView } from './derive-view'
import { largestLocalAmountWithinBalance, usdShortfall } from './quote-gap'
import {
    boundedQrType,
    createQrPaymentAttemptTelemetry,
    trackPixQrInitResult,
    type QrPaymentAttemptTelemetry,
    type QrPaymentStageOutcome,
} from './qr-payment-telemetry'
import type { PaymentProcessor, QrPayFlowBag, QrPayScanParams } from './qr-pay-flow.types'
import type { QrPaymentLock } from '@/services/manteca'
import { isLockExpired, receiveLock } from '@/utils/price-lock.utils'
import { QrKycState } from '@/constants/kyc.consts'
import { pixMinimumBrl } from '@/features/pix/pixRoute.utils'
import { isUnderPixMinimum } from '@/features/pix/pixQuote.utils'
import { pixShownRate } from '@/features/pix/pixFlow.utils'
import { pixRateAndFee, showsProviderRateAndFee } from '@/features/pix/pixRateAndFee'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { formatBankAmount } from '@/utils/currency'
import { pixProviderId } from '@/utils/provider.utils'
import { brTaxIdKind } from '@/utils/br-tax-id.utils'
import type { ProviderId } from '@/types/provider.types'
import { usePixPayment, type PixPayOutcome } from './usePixPayment'
import { pixPaidPerk, type PaidReward } from './paidReward'
import { useQrPayRoute } from './useQrPayRoute'

const MAX_QR_PAYMENT_AMOUNT = '2000'
const MIN_QR_PAYMENT_AMOUNT = '0.1'

/** What the status view says once a payment is no longer moving, or has waited past its arrival time. */
export type QrPaymentStatus = ReturnType<typeof qrPaymentDisplayStatus>

const PIX_PAY_STATUS: Record<Exclude<PixPayOutcome, 'paid'>, QrPaymentStatus> = {
    processing: 'processing',
    refunded: 'refunded',
    cancelled: 'cancelled',
    'needs-support': 'failed',
}

// Entity-aware deposit address served by the API (per-entity balances from
// 2026-09-14) — the backend resolves the entity from the QR and the paying
// Manteca account. The per-rail constants remain only as a fallback for an
// older API that does not return the field yet.
function mantecaDepositRecipient(lock: QrPaymentLock, qrType: string | null) {
    return pickMantecaDepositAddress(
        lock.depositAddress,
        qrType === EQrType.PIX ? MANTECA_QR_DEPOSIT_ADDRESS_NON_AR : MANTECA_QR_DEPOSIT_ADDRESS_AR
    )
}

function attemptOutcomeForStatus(status: ReturnType<typeof qrPaymentDisplayStatus>): QrPaymentStageOutcome {
    if (status === 'completed') return 'success'
    if (status === 'cancelled') return 'cancelled'
    if (status === 'processing') return 'pending'
    return 'failed'
}

/**
 * All qr-pay behavior: the payment-lock query, scan-outcome classification,
 * currency and amount seeding, payment execution, and the derived view. Called
 * exactly ONCE, by `QrPayFlowProvider` — effects here must never run per-view.
 * Views read the result through `useQrPayFlow()`.
 */
export function useQrPayFlowController(
    bag: QrPayFlowBag,
    scan: QrPayScanParams,
    /** Told whether a payment of this scan may exist, so the page keeps the flow mounted while it does. */
    onPaymentPinned?: (pinned: boolean) => void
) {
    const { qrCode, timestamp, qrType } = scan
    const pixKeyLabel = verifiedPixKeyLabel(qrCode, scan.pixKey ?? null)
    // Usually a cache hit: the key screen resolved it on Continue. A pasted key
    // from the scanner resolves here. Without data the key itself is shown.
    const { data: pixKeyOwner, error: pixKeyOwnerError, isPending: isPixKeyOwnerPending } = usePixKeyOwner(pixKeyLabel)
    // A pasted key reaches the form before its lookup answers. Pay waits for the
    // answer, so the user sees who is paid, or the unknown-key stop, first.
    const isAwaitingPixKeyOwner = !!pixKeyLabel && isPixKeyOwnerPending
    const pixKeySave = usePixKeySavePrompt(pixKeyLabel, pixKeyOwner?.name)
    const tWithdraw = useTranslations('withdraw')
    const tPix = useTranslations('pix')
    const t = useAppTranslations('qrPay')
    const tErrors = useTranslations('errors')
    const toFriendlyError = useFriendlyError()
    // rewinds to home past every entry the flow pushed; a replace kept the
    // earlier entries, so back from home re-entered the flow
    const leaveToHome = useReturnTo('/home')
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

    // Controller-recovery quote handoff: neutral notice + a blocked Pay while
    // the replacement quote is being obtained, cancellable by leaving.
    const submittedPaymentRef = useRef(false)
    const [amountEntryRejection, setAmountEntryRejection] = useState<ReturnType<typeof classifyQrInitError>>(null)
    useEffect(() => {
        setAmountEntryRejection(null)
        submittedPaymentRef.current = false
    }, [scanIdempotencyKey])
    const [quoteUpdatedNotice, setQuoteUpdatedNotice] = useState<string | null>(null)
    // Bumped when the flow itself replaces the typed amount: the amount field
    // ignores a new initialAmount once the user has typed, so it must remount.
    const [amountInputRevision, setAmountInputRevision] = useState(0)
    const [isQuoteRecovering, setIsQuoteRecovering] = useState(false)
    /** A replacement quote failed to mint: the payment did NOT fail, so Pay
     *  stays available and one more tap retries the whole thing. */
    const [requoteFailed, setRequoteFailed] = useState(false)
    const quoteRecoveryCancelledRef = useRef(false)
    // Leaving the screen — including a browser/gesture back that never runs the
    // in-app handler — cancels a recovery in flight: no replacement quote is
    // requested and nothing is signed or submitted afterwards.
    useEffect(
        () => () => {
            quoteRecoveryCancelledRef.current = true
        },
        []
    )
    const quoteRecoveryAttemptRef = useRef(0)
    const quoteRecoveryInFlightRef = useRef(false)
    /** Identity of the CURRENT replacement quote; held across its retries. */
    const replacementQuoteKeyRef = useRef<string | null>(null)

    const { spendableBalance: balance, balance: smartBalance, address: walletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const repairRainController = useRainControllerRepair()
    const recoverSignedSpend = useSignedSpendRecovery()
    const handleStaleSession = useStaleSessionGuard()
    const { overview: rainCardOverview } = useRainCardOverview()
    const { user, fetchUser } = useAuth()
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

    // A Pix code whose pay route names the neutral routes is paid there (API-CONTRACT-M4 §1).
    const { route: pixPayRoute, viaPixRoutes } = useQrPayRoute(qrCode, qrType)
    const routeProcessor: PaymentProcessor | null = useMemo(() => {
        if (viaPixRoutes) return 'PIX_PAY'
        switch (qrType) {
            case EQrType.MERCADO_PAGO:
            case EQrType.ARGENTINA_QR3:
            case EQrType.PIX:
                return 'MANTECA'
            default:
                return null
        }
    }, [qrType, viaPixRoutes])
    // While a payment of this scan may exist, the processor that opened it keeps the flow: a route that
    // changes under it (a gate opening, the user read again) would reset that payment's screen and offer
    // Pay again for a code already paid. Set below, once the payment's own state is known.
    const [pinnedProcessor, setPinnedProcessor] = useState<PaymentProcessor | null>(null)
    const paymentProcessor = pinnedProcessor ?? routeProcessor
    // A Manteca signature began for this scan: from here a payment may exist on Manteca.
    const [mantecaSigningStarted, setMantecaSigningStarted] = useState(false)
    const isPixPay = paymentProcessor === 'PIX_PAY'
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

    // Check if this payment provider is under maintenance. The Pix pay routes carry their provider's
    // pause on the route itself (the Brazil pause view below reads it).
    const { disabledPaymentProviders } = useKillSwitches()
    const isProviderDisabled = useMemo(() => {
        return paymentProcessor === 'MANTECA' ? disabledPaymentProviders.includes(paymentProcessor) : false
    }, [paymentProcessor, disabledPaymentProviders])
    // the pay:PIX_BR route says whether a Pix payment can start: the Brazil pause, or a residence it does not serve
    const pixBlock = usePixPayBlock()
    const qrPixBlock = qrType === EQrType.PIX || isPixEmvcoQr(qrCode) ? pixBlock : null
    const isBrazilPaused = qrPixBlock !== null
    // Neither an outage nor the Brazil pause starts a payment. The view keeps them
    // apart: a payment made before the pause still shows its status (TASK-24197).
    const blocksNewPayment = isProviderDisabled || isBrazilPaused

    const qrGate = useQrPayKycGate()
    // On the Pix pay routes the route is the gate: the page mounts this flow only once it is ready.
    const gate = useMemo(
        () => (isPixPay ? { ...qrGate, kycGateState: QrKycState.PROCEED_TO_PAY, shouldBlockPay: false } : qrGate),
        [isPixPay, qrGate]
    )
    const { kycGateState, shouldBlockPay } = gate

    const pixPayMinimumBrl = isPixPay ? pixMinimumBrl(pixPayRoute) : null
    const pixPayment = usePixPayment({
        brCode: qrCode,
        timestamp,
        enabled: isPixPay,
        canStart: !blocksNewPayment,
        amountBrl: currencyAmount,
        minimumBrl: pixPayMinimumBrl,
        provider: pixPayRoute?.provider,
    })
    const pixPayReviewed = pixPayment.reviewed
    const pixPayOutcome = pixPayment.outcome

    // A Pix payment may exist from its open until a refusal says nothing opened (the phase is back to
    // idle with no id); a Manteca one from its first signature until a failure that surely sent nothing
    // (a dismissed passkey, a signing failure, a refusal before the send). An unknown send keeps it.
    const paymentMayExist =
        paymentProcessor === 'PIX_PAY'
            ? pixPayment.phase !== 'idle' || !!pixPayment.intentId
            : paymentProcessor === 'MANTECA' && (mantecaSigningStarted || !!qrPayment || isSuccess)
    useEffect(() => {
        setPinnedProcessor(paymentMayExist ? paymentProcessor : null)
        onPaymentPinned?.(paymentMayExist)
    }, [paymentMayExist, paymentProcessor, onPaymentPinned])
    // the hold-to-claim reveal of a Pix pay-route payment's reward; Manteca's lives on its qrPayment
    const [pixRewardClaimed, setPixRewardClaimed] = useState(false)
    // the paid payment's entry: what left the wallet after a reload, and the receipt
    const { data: pixPayEntry } = useHistoryEntry(pixPayment.intentId, 'QR_PAY', {
        enabled: isPixPay && pixPayOutcome === 'paid',
    })

    /*
     * The final, locked spend — only a fixed-amount QR has one before Pay. An
     * open-amount QR mints its lock inside handleMantecaPayment, so it has
     * nothing to prepare against and takes the full path.
     */
    const lockedSpend = useMemo(() => {
        if (paymentProcessor !== 'MANTECA' || !paymentLock || paymentLock.code === '') return null
        try {
            return {
                lockCode: paymentLock.code,
                lockExpiresAt: paymentLock.deadline ?? null,
                requiredUsdcAmount: parseUnits(paymentLock.paymentAgainstAmount, PEANUT_WALLET_TOKEN_DECIMALS),
                recipient: mantecaDepositRecipient(paymentLock, qrType),
            }
        } catch {
            // A malformed amount fails at Pay with the sign error it always did.
            return null
        }
    }, [paymentProcessor, paymentLock, qrType])

    // Build the unsigned smart-only UserOp while the user reads the amount, so
    // Pay only re-checks nonce + sponsorship and signs. Gated on the cached
    // smart balance covering the amount: a candidate can only ever serve
    // smart-only routing, and routing itself stays LIVE at Pay. Off while a
    // payment is in flight (`isLoading`): an open-amount lock minted inside
    // Pay must not start a warmup racing the very signature it is for.
    const { takePreparedSmartSpend } = useSmartSpendPreparation({
        enabled:
            !!lockedSpend &&
            !shouldBlockPay &&
            !blocksNewPayment &&
            !isLoading &&
            !isSuccess &&
            !qrPayment &&
            smartBalance !== undefined &&
            smartBalance >= lockedSpend.requiredUsdcAmount,
        // useWallet only exposes the address once it matches the user's
        // wallet; the shape check is what narrows it to a signer address.
        accountAddress: walletAddress && isAddress(walletAddress) ? walletAddress : null,
        requiredUsdcAmount: lockedSpend?.requiredUsdcAmount ?? null,
        recipient: lockedSpend?.recipient ?? null,
        lockCode: lockedSpend?.lockCode ?? null,
        lockExpiresAt: lockedSpend?.lockExpiresAt ?? null,
    })

    // The attempt whose stages are still being reported. Set at Pay; read by
    // the success-commit effect, which runs after the Pay callback returns.
    const attemptTelemetryRef = useRef<QrPaymentAttemptTelemetry | null>(null)

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

    const [rateUnavailable, setRateUnavailable] = useState(false)
    const [rateAttempt, setRateAttempt] = useState(0)
    // The rate of the last lock minted for a typed amount that the balance
    // could not pay. The form converts at it after that, not at a fresh rate: a
    // lower fresh rate would put the amount lowered to the balance back above it.
    const lastLockRateRef = useRef<string | null>(null)
    const retryRate = useCallback(() => {
        setRateUnavailable(false)
        setRateAttempt((attempt) => attempt + 1)
    }, [])

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
                price = lastLockRateRef.current
                    ? Number(lastLockRateRef.current)
                    : (await getCurrencyPrice(currencyCode)).sell
            } else {
                price = Number(paymentLock.paymentPrice)
            }
            return {
                code: currencyCode,
                symbol: currencyCode,
                price,
            }
        }
        getCurrencyObject()
            .then((currencyObject) => {
                if (!cancelled) setCurrency(currencyObject)
            })
            // The FX layer already reported the failure; without a live rate the amount cannot be priced.
            .catch(() => {
                if (!cancelled) setRateUnavailable(true)
            })
        return () => {
            cancelled = true
        }
    }, [paymentLock, paymentProcessor, setCurrency, rateAttempt])

    // A code with its own amount fills the amount from its review, as a locked Manteca code does.
    const pixPayFixedBrl = pixPayment.amountFixed ? pixPayReviewed?.amountBrl : undefined
    const pixPayFixedUsd = pixPayment.amountFixed ? pixPayReviewed?.withdrawUsd : undefined
    useEffect(() => {
        if (!pixPayFixedBrl || !pixPayFixedUsd) return
        setAmount(pixPayFixedUsd)
        setCurrencyAmount(pixPayFixedBrl)
    }, [pixPayFixedBrl, pixPayFixedUsd, setAmount, setCurrencyAmount])

    // The reais convert to what leaves the wallet, every fee in, as the Pix withdrawal's field does. The
    // rate row (`shownRate` below) is Avenia's own rate; another pay-route provider's is the all-in rate
    // (`pixShownRate`). Before a review names them (an open amount not typed yet, a reload of an opened
    // payment), the field converts with the market rate, as for Manteca's open-amount codes.
    const pixPayPrice = pixPayReviewed ? Number(pixPayReviewed.amountBrl) / Number(pixPayReviewed.withdrawUsd) : null
    const allInRate = isPixPay && pixPayReviewed ? Number(pixShownRate(pixPayReviewed)) : null
    // An opened payment (`?intentId=`) shows its result from its own read: the reais it paid, and the
    // USD from its history entry once paid. No live rate is asked for it, so an FX outage cannot hide
    // a settled payment; the rate stands at the entry's own until the entry loads (0 = none yet).
    const pixPayOpened = isPixPay && !!pixPayment.intentId
    const pixPayEntryPrice =
        pixPayEntry?.currency?.amount && Number(pixPayEntry.amount) > 0
            ? Number(pixPayEntry.currency.amount) / Number(pixPayEntry.amount)
            : null
    useEffect(() => {
        if (!pixPayOpened || pixPayPrice) return
        setCurrency({ code: 'BRL', symbol: 'BRL', price: pixPayEntryPrice ?? 0 })
    }, [pixPayOpened, pixPayPrice, pixPayEntryPrice, setCurrency])
    useEffect(() => {
        if (!isPixPay || (pixPayOpened && !pixPayPrice)) return
        let cancelled = false
        const price = pixPayPrice ? Promise.resolve(pixPayPrice) : getCurrencyPrice('BRL').then((p) => p.sell)
        price
            .then((value) => {
                if (!cancelled) setCurrency({ code: 'BRL', symbol: 'BRL', price: value })
            })
            .catch(() => {
                if (!cancelled) setRateUnavailable(true)
            })
        return () => {
            cancelled = true
        }
    }, [isPixPay, pixPayOpened, pixPayPrice, setCurrency, rateAttempt])

    // the card cool-down clock the error banner counts down (`CooldownErrorText`)
    const cooldownRemaining = useCooldownRemaining()
    const isBlockingError = useMemo(() => {
        // The settling failure says "try again in a few seconds" — keep the Pay
        // button enabled so the user can retry, don't dead-end it like a hard error.
        // A failed replacement quote is the same shape: the payment did not
        // fail, the re-quote did, and tapping Pay tries the whole thing again.
        if (requoteFailed) return false
        // Nothing was signed or sent. Pay waits only while the clock runs: once it ends, or when
        // Rain named no wait and no clock started, a tap is a new attempt (TASK-25316).
        if (errorCode === 'rainCooldownRetryShortly') return cooldownRemaining !== null
        return (
            !!errorMessage &&
            errorCode !== 'confirmTransaction' &&
            errorCode !== 'balanceSettling' &&
            // A rejection the user can clear by typing a different amount.
            errorCode !== 'amountRetryable' &&
            // Nothing was signed or sent; tapping Pay again is safe.
            errorCode !== 'signRetryable'
        )
    }, [errorMessage, errorCode, requoteFailed, cooldownRemaining])

    const usdAmount = useMemo(() => {
        // what leaves the wallet: the paid entry's, else what this session signed, else the review's figure
        if (isPixPay) return pixPayEntry?.amount ?? pixPayment.signedUsd ?? pixPayReviewed?.withdrawUsd ?? null
        if (!paymentLock) return null
        if (paymentLock.code === '') {
            // For static QR codes (user inputs amount), convert from local currency to USD
            // currencyAmount is in local currency (ARS, BRL), amount is the USD equivalent
            return amount
        } else {
            // For dynamic QR codes, backend provides the USD amount
            return paymentLock.paymentAgainstAmount
        }
    }, [isPixPay, pixPayReviewed, pixPayEntry, pixPayment.signedUsd, paymentLock, amount])

    // Fetch points early to avoid latency penalty - fetch as soon as we have usdAmount
    // This way points are cached by the time success view shows
    // Use timestamp as uniqueId to prevent cache collisions between different QR scans
    // An Avenia QR payment earns the QR lane's points as Manteca's does (API-CONTRACT-M5 §3)
    const { pointsData, pointsDivRef } = usePointsCalculation(
        PointsAction.MANTECA_QR_PAYMENT,
        usdAmount,
        paymentProcessor !== null,
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
            try {
                const lock = receiveLock(
                    await mantecaApi.initiateQrPayment(
                        { qrCode, qrType: qrType ?? undefined, idempotencyKey: scanIdempotencyKey },
                        { timeoutMs: MANTECA_QR_INIT_SCAN_TIMEOUT_MS }
                    )
                )
                if (qrType === EQrType.PIX) trackPixQrInitResult(pixQrHost(qrCode), 'ready', 'manteca')
                return lock
            } catch (error) {
                if (qrType === EQrType.PIX)
                    trackPixQrInitResult(
                        pixQrHost(qrCode),
                        isNonRetryableQrInitError(error) ? 'refused' : 'unavailable',
                        'manteca'
                    )
                throw error
            }
        },
        enabled:
            paymentProcessor === 'MANTECA' &&
            !!qrCode &&
            isPaymentProcessorQR(qrCode) &&
            // Composite Automático codes also match isPaymentProcessorQR — without
            // this the entry guard shows its error but the doomed init still fires.
            !entryGuardError &&
            !isPixRecurringCode(qrCode) &&
            !paymentLock &&
            !shouldBlockPay &&
            // The maintenance kill-switch is render-only below; without this the
            // doomed /init still fires on every scan during a provider outage.
            !blocksNewPayment,
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
        () =>
            entryGuardError ??
            (amountEntryRejection ? scanFailureCopy[amountEntryRejection.code] : null) ??
            // A pasted key the PIX directory does not know: paying it can only fail.
            (isPixKeyNotFound(pixKeyOwnerError) ? tWithdraw('pixKey.notFound') : null) ??
            // Manteca's scan only: a Pix code the route has since moved to the pay routes leaves it behind
            (paymentProcessor === 'MANTECA' && scanOutcome.kind === 'failed'
                ? scanFailureCopy[scanOutcome.reason]
                : null) ??
            // the provider's read of a code refused it: unpayable, as a refused Manteca scan
            pixPayment.codeRefusal,
        [
            entryGuardError,
            amountEntryRejection,
            pixKeyOwnerError,
            tWithdraw,
            paymentProcessor,
            scanOutcome,
            scanFailureCopy,
            pixPayment.codeRefusal,
        ]
    )
    // The generic init card has no support entry; these refusals need one.
    const initErrorNeedsSupport =
        (amountEntryRejection && SUPPORT_ACTIONABLE_FAILURES.has(amountEntryRejection.code)) ||
        (scanOutcome.kind === 'failed' && SUPPORT_ACTIONABLE_FAILURES.has(scanOutcome.reason)) ||
        false
    // The API refused the scan for identity, whatever the capabilities said:
    // the card offers the verification step instead of only "Go back".
    const initErrorNeedsVerification = scanOutcome.kind === 'failed' && scanOutcome.reason === QR_INIT_CODE.KYC
    // The same answer can pause the QR rails (a pool payment with no sender
    // identity). Read the user again, so the gate and the verification step
    // act on what the API decided rather than on the capabilities from before.
    useEffect(() => {
        if (initErrorNeedsVerification) void fetchUser()
    }, [initErrorNeedsVerification, fetchUser])
    // Manteca's init refused a Pix code because Manteca no longer serves it for this user: moved to
    // another provider, its BRL switched off (503), or the route's refusal (403). The capabilities are
    // read again, and the page follows the route: the pay routes, the pause, or the refusal (M5).
    const pixInitRouteChanged =
        paymentProcessor === 'MANTECA' &&
        (qrType === EQrType.PIX || isPixEmvcoQr(qrCode)) &&
        [
            API_ERROR_CODES.PIX_PROVIDER_MOVED,
            API_ERROR_CODES.PROVIDER_UNAVAILABLE,
            API_ERROR_CODES.ROUTE_NOT_AVAILABLE,
        ].some((code) => code === wireErrorCode(paymentLockError ?? paymentLockFailureReason))
    useEffect(() => {
        if (pixInitRouteChanged) void fetchUser()
    }, [pixInitRouteChanged, fetchUser])

    // Side effects only. Everything the screen RENDERS is derived above.
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return

        if (fetchedPaymentLock && !paymentLock) setPaymentLock(fetchedPaymentLock)

        if (scanOutcome.kind === 'awaiting-merchant-amount') setWaitingForMerchantAmount(true)
        else if (scanOutcome.kind !== 'pending' && scanOutcome.kind !== 'idle') setWaitingForMerchantAmount(false)

        if (scanOutcome.kind === 'failed') {
            if (scanOutcome.reason === QR_INIT_CODE.DECODE) {
                posthog.capture(ANALYTICS_EVENTS.QR_DECODING_ERROR_SHOWN, { qr_type: qrType })
            } else if (scanOutcome.reason === QR_INIT_CODE.EXPIRED) {
                posthog.capture(ANALYTICS_EVENTS.QR_MERCHANT_CHARGE_EXPIRED_SHOWN, { qr_type: qrType })
            } else if (scanOutcome.reason === QR_INIT_CODE.SENDER_REJECTED) {
                // A support case, not a transport failure: nothing else records it.
                posthog.capture(ANALYTICS_EVENTS.QR_SENDER_REJECTED_SHOWN, { qr_type: qrType })
            }
        }
    }, [
        scanOutcome,
        fetchedPaymentLock,
        paymentLock,
        paymentProcessor,
        qrType,
        setPaymentLock,
        setWaitingForMerchantAmount,
    ])

    /*
     * `idle` deliberately touches nothing. A disabled query — invalid QR,
     * KYC-blocked user, provider maintenance — must not drive the app-wide
     * loading context, which survives navigation away from this route.
     * Keyed on the kind alone: a Pay tap stores its own lock while the scan
     * stays `ready`, and a re-run here set that tap's loading state back to
     * Idle until the passkey opened (TASK-25316).
     */
    const scanKind = scanOutcome.kind
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return
        if (scanKind === 'pending') setLoadingState('Fetching details')
        else if (scanKind === 'retrying') setLoadingState('Still fetching details')
        else if (scanKind !== 'idle') setLoadingState('Idle')
    }, [paymentProcessor, scanKind, setLoadingState])

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
                leaveToHome()
            }
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [leaveToHome])

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

    const pixPayMerchant = pixPayment.merchant
    const merchantName = useMemo(() => {
        // a code without an amount names its merchant once the reais typed are reviewed; "Pix" until then
        if (isPixPay) return pixPayMerchant?.merchantName ?? 'Pix'
        if (!paymentLock) return null
        return pixKeyOwner?.name ?? pixKeyLabel ?? paymentLock.paymentRecipientName
    }, [isPixPay, pixPayMerchant, paymentLock, pixKeyLabel, pixKeyOwner])
    // the merchant's tax id as the provider read it from the code (a CNPJ in full, a CPF masked)
    const merchantTaxIdMasked = isPixPay ? (pixPayMerchant?.merchantTaxIdMasked ?? null) : null
    // a CNPJ comes punctuated in full, which the kind reads only bare
    const merchantTaxIdKind = merchantTaxIdMasked ? brTaxIdKind(merchantTaxIdMasked.replace(/[.\-/]/g, '')) : null
    const merchantTaxId =
        merchantTaxIdMasked && merchantTaxIdKind ? { kind: merchantTaxIdKind, value: merchantTaxIdMasked } : null

    const recipientBankName = isPixPay ? (pixPayMerchant?.bankName ?? null) : recipientBankNameOf(paymentLock)
    // the legal record behind the provider row: the opened payment's provider (a route that changed since
    // names another), else the route's, or Manteca's entity for the code's country
    const providerId: ProviderId | null = isPixPay
        ? pixProviderId(
              pixPayment.intentId
                  ? // the read, else the open while the passkey is open (the read is off then)
                    (pixPayment.payment?.provider ?? pixPayment.openedProvider)
                  : pixPayRoute?.provider
          )
        : paymentProcessor === 'MANTECA' && targetMantecaCountry
          ? targetMantecaCountry === 'BR'
              ? 'manteca-br'
              : 'manteca-ar'
          : null
    // Avenia: the review's rate and fee rows (TASK-24967: the variable fees in the rate, the flat fee as
    // the row), or neither row before a review names them; never the market rate. Another pay-route
    // provider keeps the all-in rate and its flat fee.
    const providerRows = isPixPay && showsProviderRateAndFee(providerId)
    const reviewedPair = providerRows ? pixRateAndFee(pixPayReviewed) : null
    const shownRate = providerRows ? (reviewedPair?.exchangeRate ?? null) : allInRate
    const hideRate = providerRows && !reviewedPair
    const pixPayFee = providerRows ? reviewedPair?.providerFeeBrl : pixPayReviewed?.fixedFeeBrl
    // the form's "Provider fee" row, shared with the Pix withdrawal; the Manteca lock carries none (`QrPaymentLock`)
    const providerFee: string | null =
        isPixPay && pixPayFee && Number(pixPayFee) > 0 ? formatBankAmount(pixPayFee, 'BRL') : null
    // the code fixes the amount: the field cannot change it
    const amountFixed = isPixPay
        ? pixPayment.amountFixed === true
        : paymentProcessor === 'MANTECA' && paymentLock?.code !== ''

    /*
     * Controller-rotation handoff. Nothing moved and no provider order exists
     * (a broadcast may well have happened and reverted definitively), so the
     * SAME payment stays open: wait out Rain's cooldown (cancellable, Pay blocked),
     * then mint a REPLACEMENT quote for the same scan and amount under a new
     * identity — replaying the scan key would hand back the lock that just
     * became unusable — publish it, and wait for the user to confirm it.
     */
    const handleQuoteRecovery = useCallback(
        async (recovery: SpendRecoveryQuoteReviewError) => {
            if (!qrCode) return
            // One refresh at a time: a second entry would race two quotes.
            if (quoteRecoveryInFlightRef.current || isBrazilPaused) return
            quoteRecoveryInFlightRef.current = true
            quoteRecoveryCancelledRef.current = false
            setIsSuccess(false)
            setQrPayment(null)
            setLoadingState('Idle')
            setIsQuoteRecovering(true)
            setQuoteUpdatedNotice(t('reviewUpdatedQuote'))
            try {
                if (recovery.retryAfterSec) {
                    const proceed = await sleepUnlessCancelled(
                        recovery.retryAfterSec * 1000 + 1_000,
                        () => quoteRecoveryCancelledRef.current
                    )
                    if (!proceed) return
                }
                /*
                 * ONE identity per recovery event, reused by every retry of it
                 * (including after an uncertain transport failure) so the
                 * backend replays that quote instead of minting another. A new
                 * identity is allocated only for a genuinely new event.
                 */
                // Covers a cancel that landed while the flow was setting up, or
                // any path that reaches here without a cooldown wait.
                if (quoteRecoveryCancelledRef.current) return
                if (!replacementQuoteKeyRef.current) {
                    replacementQuoteKeyRef.current = `recovery-${++quoteRecoveryAttemptRef.current}`
                }
                const fresh = receiveLock(
                    await mantecaApi.initiateQrPayment({
                        qrCode,
                        amount: currencyAmount,
                        qrType: qrType ?? undefined,
                        idempotencyKey: qrInitIdempotencyKey({
                            qrCode,
                            timestamp,
                            amount: currencyAmount,
                            replacement: replacementQuoteKeyRef.current,
                        }),
                    })
                )
                if (quoteRecoveryCancelledRef.current) return
                setRequoteFailed(false)
                setErrorMessage('')
                setPaymentLock(fresh)
                // The event is closed; a later rotation gets its own identity.
                replacementQuoteKeyRef.current = null
            } catch (error) {
                // Re-quoting failed: this is still not a failed payment — the
                // user stays on review, and the next tap RETRIES THE QUOTE with
                // the same identity, never the dead lock.
                setRequoteFailed(true)
                setErrorMessage(toFriendlyError(error))
            } finally {
                setIsQuoteRecovering(false)
                quoteRecoveryInFlightRef.current = false
            }
        },
        [
            qrCode,
            qrType,
            isBrazilPaused,
            timestamp,
            currencyAmount,
            t,
            toFriendlyError,
            setErrorMessage,
            setIsSuccess,
            setLoadingState,
            setPaymentLock,
            setQrPayment,
        ]
    )

    const cancelQuoteRecovery = useCallback(() => {
        quoteRecoveryCancelledRef.current = true
        setIsQuoteRecovering(false)
    }, [])

    /** Leaving the screen is the user's explicit cancel: no quote is minted and
     *  nothing is prepared, signed or submitted afterwards. */
    const onBackFromQrPay = useCallback(() => {
        cancelQuoteRecovery()
        onBack()
    }, [cancelQuoteRecovery, onBack])

    const handleMantecaPayment = useCallback(async () => {
        if (!paymentLock || !qrCode || !currencyAmount || isBrazilPaused || amountEntryRejection) return
        // A refresh already owns the flow (cooldown wait or init in flight).
        if (isQuoteRecovering) return
        // This tap starts a new attempt, a re-quote included. The error the last attempt left
        // with Pay usable no longer applies; this attempt sets its own if it fails (TASK-25316).
        if (!isBlockingError) setErrorMessage(null)
        // The previous re-quote never landed: this tap retries the QUOTE only —
        // signing the old lock is exactly what must not happen. The user then
        // sees the fresh terms and taps again to pay.
        if (requoteFailed) {
            await handleQuoteRecovery(new SpendRecoveryQuoteReviewError(new Error('quote refresh retry')))
            return
        }
        // This tap IS the confirmation of whatever quote is on screen.
        setQuoteUpdatedNotice(null)

        // One attempt id per Pay press, minted BEFORE the open-amount init so
        // the lock stage belongs to it. A retry is a new signature and so a
        // new attempt; the id only rides along with the artifact signed here.
        // Rail label from the lock's provider type first (what the server
        // reports too), the scanner's type as the fallback — bounded either way.
        const telemetry = createQrPaymentAttemptTelemetry({
            qrType: boundedQrType(paymentLock.type) ?? boundedQrType(qrType),
            pixQrHost: pixQrHost(qrCode),
            provider: 'manteca',
        })
        attemptTelemetryRef.current = telemetry
        telemetry.stage('pay_clicked')
        const finishAttempt = (outcome: QrPaymentStageOutcome) => telemetry.stage('attempt_finished', { outcome })

        let finalPaymentLock = paymentLock
        if (finalPaymentLock.code === '') {
            setLoadingState('Fetching details')
            try {
                finalPaymentLock = receiveLock(
                    await mantecaApi.initiateQrPayment({
                        qrCode,
                        amount: currencyAmount,
                        qrType: qrType ?? undefined,
                        // The amount is part of the identity: a different number is
                        // a genuinely different lock, so it must not replay the last one.
                        idempotencyKey: qrInitIdempotencyKey({ qrCode, timestamp, amount: currencyAmount }),
                    })
                )
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
                telemetry.stage('lock_ready', {
                    outcome: 'failed',
                    ...(deterministic ? { failureCode: deterministic.code } : {}),
                })
                if (deterministic) {
                    if (
                        [QR_INIT_CODE.PAYER_BLOCKED, QR_INIT_CODE.MERCHANT_BLOCKED, QR_INIT_CODE.PIX_RESIDENCE].some(
                            (code) => code === deterministic.code
                        )
                    )
                        setAmountEntryRejection(deterministic)
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
                finishAttempt('failed')
                return
            }
        }
        if (finalPaymentLock.code === '') {
            telemetry.stage('lock_ready', { outcome: 'failed' })
            setErrorMessage(t('errors.fetchDetails'))
            setIsSuccess(false)
            setLoadingState('Idle')
            finishAttempt('failed')
            return
        }
        telemetry.stage('lock_ready', { outcome: 'success' })

        setLoadingState('Preparing transaction')
        // Direct collateral funding needs one admin signature. Mixed funding
        // combines both balances and also needs a UserOp signature.
        // Same terms on a recovery re-sign: only the prep and the signature are
        // fresh — amount, recipient and the payment lock below are not.
        // Signing has only begun once the engine reports its preparation done
        // (`signing_preparation_ready` fires right before the first ceremony).
        // Routing, balance reads and the collateral preflight run before that
        // and can fail on their own; those failures never reached a signature.
        // A recovery re-sign goes through the same input, so it reports too.
        let signingStarted = false

        const signSpendInput = () => ({
            requiredUsdcAmount: parseUnits(finalPaymentLock.paymentAgainstAmount, PEANUT_WALLET_TOKEN_DECIMALS),
            recipient: mantecaDepositRecipient(finalPaymentLock, qrType),
            rainSpendingPower: rainCentsToUsdcUnits(rainCardOverview?.balance?.spendingPower),
            kind: 'QR_PAY' as const,
            // Lets an internal recovery wait out a Rain cooldown that still
            // fits this lock instead of re-quoting.
            lockExpiresAt: finalPaymentLock.deadline,
            // Consumed whatever routing decides: only smart-only can sign
            // it, and after Pay its nonce may be spent either way. A recovery
            // re-sign calls this again, by which time it is already spent.
            preparedSmartSpend: takePreparedSmartSpend(),
            onStrategyDecided: (strategy: Exclude<SpendStrategy, 'insufficient'>) =>
                telemetry.stage('strategy_ready', { strategy }),
            onProgress: (event: SignSpendProgressEvent) => {
                if (event.stage === 'signing_preparation_ready') {
                    signingStarted = true
                    setLoadingState('Approve transaction')
                    telemetry.stage(event.stage, { preparation: event.preparation })
                } else {
                    telemetry.stage(event.stage)
                }
            },
        })

        /*
         * The quote bounds EVERY attempt, not just the first signature: a
         * passkey sheet is unbounded and a replacement is signed later still.
         * An expired lock is a neutral re-quote + reconfirm — never a signature
         * and never a submission under terms the user did not see.
         */
        const quoteExpired = () => isLockExpired(finalPaymentLock)
        if (quoteExpired()) {
            await handleQuoteRecovery(new SpendRecoveryQuoteReviewError(new Error('quote expired')))
            return
        }

        let signedArtifact
        // From here a payment may exist on Manteca, so the flow stays on it whatever the Pix route says
        // next. Each path that surely sent nothing releases it, and the page follows the route again.
        setMantecaSigningStarted(true)
        try {
            signedArtifact = await signSpend(signSpendInput())
            telemetry.stage('signature_ready', { outcome: 'success' })
        } catch (error) {
            // nothing is submitted before the signature returns
            setMantecaSigningStarted(false)
            // Controller-recovery control flow (nothing signed, nothing sent):
            // back to the same review screen, with a refreshed quote when the
            // replacement could not be prepared inside the current lock.
            if (error instanceof SpendRecoveryQuoteReviewError) {
                await handleQuoteRecovery(error)
                return
            }
            if (error instanceof SpendRecoveryAbortedError) {
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
            // The lock this tap minted for a typed amount needs more than the
            // balance (TASK-24621). Nothing was signed: the form goes back to
            // the open amount, which stays the user's to change.
            if (error instanceof InsufficientSpendableError && paymentLock.code === '') {
                const fittedAmount = largestLocalAmountWithinBalance({
                    localAmount: currencyAmount,
                    shownUsd: amount,
                    lockedUsdc: error.required,
                    availableUsdc: error.available,
                })
                lastLockRateRef.current = finalPaymentLock.paymentPrice
                setPaymentLock(paymentLock)
                setAmount(amount)
                setCurrencyAmount(fittedAmount ?? currencyAmount)
                if (fittedAmount) {
                    // Waiting cannot help. The field shows the largest amount
                    // that fits, and the next tap pays it.
                    setAmountInputRevision((revision) => revision + 1)
                    setErrorMessage(null)
                } else {
                    setErrorMessage(tErrors('balanceSettling'), 'balanceSettling')
                }
                setIsSuccess(false)
                setLoadingState('Idle')
                finishAttempt('failed')
                return
            }
            // Route through the shared classifier so backend wire codes reach this
            // screen too; the two branches ahead of it are deliberately per-flow.
            const classified = friendlyError(error)
            const userCancelled = (error as Error).toString().includes('not allowed')
            // A signature stage is reported only if signing was actually
            // reached; an earlier failure ends the attempt with its outcome
            // alone, so the funnel never shows a signature that never started.
            if (signingStarted) telemetry.stage('signature_ready', { outcome: userCancelled ? 'cancelled' : 'failed' })
            if (error instanceof SessionKeyGrantRequiredError) {
                setErrorMessage(t('errors.cardAuthNeeded'))
            } else if (userCancelled) {
                // Looser than the classifier's 'not allowed by the user agent';
                // kept as-is so this screen's matching doesn't narrow.
                setErrorMessage(t('errors.confirmTransaction'), 'confirmTransaction')
            } else if (isPasskeyCleanupPendingError(error)) {
                // Retryable: the next tap asks native again; tagged apart from busy so its rate stays visible.
                void captureNetworkTriagedFailure(error, {
                    tags: {
                        ...criticalFlowTags('qr-pay'),
                        qr_pay_step: 'sign',
                        qr_pay_failure: 'passkey_cleanup_pending',
                    },
                })
                setErrorMessage(t('errors.passkeyStillOpen'), 'signRetryable')
            } else if (isPasskeyBusyError(error)) {
                // an earlier passkey prompt still owns the authenticator; nothing was signed.
                // still reported, tagged apart, so the busy rate stays visible
                void captureNetworkTriagedFailure(error, {
                    tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'sign', qr_pay_failure: 'passkey_busy' },
                })
                setErrorMessage(t('errors.passkeyBusy'), 'signRetryable')
            } else if (classified.kind === 'code' && classified.code === 'genericSupport') {
                // Keep the flow-specific fallback — "couldn't sign" beats the
                // generic support copy on a signing failure — and the Sentry report.
                void captureNetworkTriagedFailure(error, {
                    tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'sign' },
                })
                // before the passkey, the failure was routing, the rain draft or
                // the op build; nothing was signed or sent either way, so retry is safe
                setErrorMessage(t(signingStarted ? 'errors.signFailed' : 'errors.preparationFailed'), 'signRetryable')
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
            finishAttempt(userCancelled ? 'cancelled' : 'failed')
            return
        }

        if (quoteExpired()) {
            setMantecaSigningStarted(false)
            await handleQuoteRecovery(new SpendRecoveryQuoteReviewError(new Error('quote expired while signing')))
            return
        }

        // Send signed artifact to backend for coordinated execution. The modern
        // mixed/userOp route broadcasts the funding op FIRST — a definitive
        // revert leaves no provider order behind, which is what makes the
        // replacement below safe.
        setLoadingState('Paying')
        try {
            // Built from the artifact actually being submitted: a recovery
            // replacement carries a fresh prep + signature under the SAME lock.
            const requestBody = (artifact: typeof signedArtifact) =>
                artifact.strategy === 'collateral-only'
                    ? ({
                          kind: 'rainWithdrawal' as const,
                          clientPaymentAttemptId: telemetry.attemptId,
                          ...(boundedQrType(finalPaymentLock.type) === 'PIX' ? { pixQrHost: pixQrHost(qrCode) } : {}),
                          paymentLockCode: finalPaymentLock.code,
                          qrType: qrType ?? undefined,
                          signedRainWithdrawal: artifact.rainWithdrawal,
                          chainId: PEANUT_WALLET_CHAIN.id.toString(),
                      } as const)
                    : ({
                          kind: 'userOp' as const,
                          clientPaymentAttemptId: telemetry.attemptId,
                          ...(boundedQrType(finalPaymentLock.type) === 'PIX' ? { pixQrHost: pixQrHost(qrCode) } : {}),
                          paymentLockCode: finalPaymentLock.code,
                          qrType: qrType ?? undefined,
                          signedUserOp: artifact.signedUserOp.signedUserOp,
                          chainId: artifact.signedUserOp.chainId,
                          entryPointAddress: artifact.signedUserOp.entryPointAddress,
                          // For mixed: tell backend about the Rain prepare intent
                          // embedded in the UserOp's batched callData so it can
                          // reconcile the collateral webhook to QR_PAY in history.
                          ...(artifact.strategy === 'mixed' ? { rainPreparationId: artifact.rainPreparationId } : {}),
                      } as const)
            telemetry.stage('request_sent')
            const qrPaymentResponse = await submitSignedSpend(
                signedArtifact,
                // Guards EVERY attempt, the recovery replacement included: the
                // replacement is signed later still, and the lock may have died
                // in between.
                (candidate) => {
                    if (quoteExpired()) throw new SpendRecoveryQuoteReviewError(new Error('quote expired before send'))
                    submittedPaymentRef.current = true
                    return mantecaApi.completeQrPaymentWithSignedTx(requestBody(candidate))
                },
                {
                    // Observes the FINAL failure only — cache repair, no retry.
                    // A typed recovery outcome is control flow, not a Rain leg.
                    onFailure: (failure) =>
                        isSpendRecoveryOutcome(failure)
                            ? undefined
                            : void repairRainController({ strategy: signedArtifact.strategy, error: failure }),
                    recover: (failure, artifact) =>
                        recoverSignedSpend(
                            failure,
                            artifact,
                            // Same terms, same lock — only the prep and the
                            // signature are fresh, and its own 425 is ours.
                            () => signSpend({ ...signSpendInput(), suppressCooldownEvent: true }),
                            { lockExpiresAt: finalPaymentLock.deadline }
                        ),
                }
            )
            telemetry.stage('response_received', { outcome: 'success' })
            // Map backend field name (sponsoredUsd) to frontend field name (amountSponsored)
            const perkResponse = qrPaymentResponse.perk as Record<string, unknown> | undefined
            if (qrPaymentResponse.perk && typeof perkResponse?.sponsoredUsd === 'number') {
                qrPaymentResponse.perk.amountSponsored = perkResponse.sponsoredUsd
            }

            setQrPayment(qrPaymentResponse)
            const displayStatus = qrPaymentDisplayStatus(qrPaymentResponse.status)
            if (displayStatus !== 'completed') {
                setIsSuccess(false)
                setLoadingState('Idle')
                void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                finishAttempt(attemptOutcomeForStatus(displayStatus))
                return
            }

            // all eligible perks go through hold-to-claim — no auto-claiming.
            // this ensures a consistent reward experience regardless of amount.

            // `success_committed` + `attempt_finished` fire from the isSuccess
            // effect below: that is the commit, not this line.
            setIsSuccess(true)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, {
                strategy: signedArtifact.strategy,
                kind: 'QR_PAY',
                flow: 'sign-only',
            })
        } catch (error) {
            if (error instanceof MutationResponseTimeoutError) {
                telemetry.stage('response_received', { outcome: 'unknown' })
                void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                setErrorMessage(t('errors.paymentStatusUnknown'))
                setIsSuccess(false)
                finishAttempt('unknown')
                return
            }
            // `response_received` is HTTP-level: an error response is still a
            // response. A transport failure (timeout, offline) received
            // nothing, so that stage is not reported at all. The money
            // outcome is decided per branch below, never from a status code.
            if (!isNetworkLayerFailure(error)) telemetry.stage('response_received', { outcome: 'failed' })
            /*
             * Controller-recovery control flow, handled BEFORE any failure
             * copy: the payment never left the client, so the user goes back to
             * the same review screen — with a refreshed quote when the old one
             * could not survive Rain's cooldown — and pays again explicitly.
             * Nothing is submitted under refreshed terms without that tap.
             */
            if (error instanceof SpendRecoveryQuoteReviewError) {
                submittedPaymentRef.current = false
                setMantecaSigningStarted(false)
                await handleQuoteRecovery(error)
                return
            }
            if (error instanceof SpendRecoveryAbortedError) {
                submittedPaymentRef.current = false
                setMantecaSigningStarted(false)
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
            if (wireErrorCode(error) === API_ERROR_CODES.PIX_RESIDENCE_NOT_SUPPORTED) {
                submittedPaymentRef.current = false
                setMantecaSigningStarted(false)
                setAmountEntryRejection({ code: QR_INIT_CODE.PIX_RESIDENCE, amountRetryable: false })
                setErrorMessage(scanFailureCopy[QR_INIT_CODE.PIX_RESIDENCE])
                setIsSuccess(false)
                finishAttempt('failed')
                return
            }
            if (wireErrorCode(error) === API_ERROR_CODES.MANTECA_TEMPORARILY_UNAVAILABLE) {
                setErrorMessage(tErrors('transferTemporarilyUnavailable'))
                setIsSuccess(false)
                finishAttempt('failed')
                return
            }
            if (wireErrorCode(error) === API_ERROR_CODES.QR_PAYMENT_CANCELLED) {
                setErrorMessage(t('errors.paymentCancelled'))
                setIsSuccess(false)
                finishAttempt('cancelled')
                return
            }
            // Wrong-passkey session: backend rejected the signed UserOp with
            // AA24 / wapk. Unrecoverable without re-auth — force a clean logout.
            if (handleStaleSession(error)) {
                finishAttempt('failed')
                return
            }
            void captureNetworkTriagedFailure(error, {
                tags: { ...criticalFlowTags('qr-pay'), qr_pay_step: 'submit' },
            })
            const errorMsg = (error as Error).message || 'Could not complete payment'

            // Handle specific error cases
            if (errorMsg.toLowerCase().includes('nonce')) {
                setErrorMessage(t('errors.accountStateChanged'))
                finishAttempt('failed')
            } else if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('stale')) {
                setErrorMessage(t('errors.sessionExpired'))
                finishAttempt('failed')
            } else {
                // The screen says the status is unknown; so does the attempt.
                // The backend may well have completed this payment.
                setErrorMessage(t('errors.paymentStatusUnknown'))
                finishAttempt('unknown')
            }
            setIsSuccess(false)
        } finally {
            setLoadingState('Idle')
        }
    }, [
        queryClient,
        amountEntryRejection,
        isBrazilPaused,
        tErrors,
        handleQuoteRecovery,
        isQuoteRecovering,
        requoteFailed,
        isBlockingError,
        paymentLock,
        signSpend,
        takePreparedSmartSpend,
        repairRainController,
        recoverSignedSpend,
        rainCardOverview,
        qrCode,
        amount,
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
        setAmount,
        setCurrencyAmount,
        setPaymentLock,
        setQrPayment,
    ])

    // set before the first await: a same-tick double tap reaches here twice
    // before the loading state renders, and two attempts mean two passkey
    // prompts and two rain drafts (TASK-22518). a new scan remounts the
    // provider, so it starts unlocked.
    // a re-quote is awaited inside the attempt, so the latch also covers it
    const payInFlightRef = useRef(false)
    const { pay: payThroughPixRoutes } = pixPayment
    const payQR = useCallback(async () => {
        if (!paymentProcessor || payInFlightRef.current) return
        payInFlightRef.current = true
        try {
            if (paymentProcessor === 'PIX_PAY') await payThroughPixRoutes()
            else await handleMantecaPayment()
        } finally {
            payInFlightRef.current = false
        }
    }, [paymentProcessor, payThroughPixRoutes, handleMantecaPayment])

    // The Pix pay routes report where the payment stands; the shared screens read it the way they
    // read Manteca's: the app-wide loading state while it opens, signs and pays, then success or status.
    const pixPayPhase = pixPayment.phase
    const pixPayProcessing = pixPayOutcome === 'processing' && !pixPayment.pastArrival
    useEffect(() => {
        if (!isPixPay) return
        if (pixPayPhase === 'opening') setLoadingState('Preparing transaction')
        else if (pixPayPhase === 'signing') setLoadingState('Approve transaction')
        else if (pixPayProcessing) setLoadingState('Paying')
        else setLoadingState('Idle')
    }, [isPixPay, pixPayPhase, pixPayProcessing, setLoadingState])
    useEffect(() => {
        if (isPixPay) setIsSuccess(pixPayOutcome === 'paid')
    }, [isPixPay, pixPayOutcome, setIsSuccess])

    // A payment that went through saves its key, and so does one still
    // settling: the flow does not follow it to its end, and the user asked to
    // keep an owner the directory confirmed. A Pay tap that ends in a re-quote,
    // a refusal or a failure saves nothing.
    const { saveAfterPayment: savePixKeyAfterPayment } = pixKeySave
    const isPaymentSettling = !!qrPayment && qrPaymentDisplayStatus(qrPayment.status) === 'processing'
    useEffect(() => {
        if (isSuccess || isPaymentSettling) savePixKeyAfterPayment()
    }, [isSuccess, isPaymentSettling, savePixKeyAfterPayment])

    /*
     * Balance and floor/cap validation, derived — the old effect-and-state pair
     * could only ever restate these inputs. `shortOfBalance` marks the one
     * refusal that adding money fixes, so the form offers Add money for it.
     */
    const balanceError = useMemo((): { message: string; shortOfBalance?: true } | null => {
        // The pay route's minimum, checked before any call (Aleks, 2026-11-14), then the review's refusal
        // of the amount typed. Both name the amount, so both sit under the amount field.
        if (isPixPay && pixPayMinimumBrl && isUnderPixMinimum(currencyAmount, pixPayMinimumBrl)) {
            return { message: tPix('deposit.minimum', { amount: formatBankAmount(pixPayMinimumBrl, 'BRL') }) }
        }
        if (isPixPay && pixPayment.amountRefusal) return { message: pixPayment.amountRefusal }
        if (
            (!Number(usdAmount) && !Number(currencyAmount)) ||
            !usdAmount ||
            isNaN(Number(usdAmount)) ||
            balance === undefined
        ) {
            return null
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)

        // Manteca-specific validation (PIX, MercadoPago, QR3)
        if (paymentProcessor === 'MANTECA') {
            if (paymentAmount < parseUnits(MIN_MANTECA_QR_PAYMENT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
                return {
                    message: t(pixKeyLabel ? 'errors.minTransferAmount' : 'errors.minMantecaAmount', {
                        amount: MIN_MANTECA_QR_PAYMENT_AMOUNT,
                    }),
                }
            }
            // PIX rail enforces a 1 BRL minimum, stricter than the USD floor above
            if (currency?.code === 'BRL' && currencyAmount && parseFloat(currencyAmount) < MIN_PIX_AMOUNT_BRL) {
                return { message: t('errors.minPixAmountBrl', { amount: MIN_PIX_AMOUNT_BRL }) }
            }
        }

        // Common validations for all payment processors
        if (paymentAmount > parseUnits(MAX_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            return {
                message: t(pixKeyLabel ? 'errors.maxTransferAmount' : 'errors.maxQrAmount', {
                    amount: MAX_QR_PAYMENT_AMOUNT,
                }),
            }
        }
        if (paymentAmount < parseUnits(MIN_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            return {
                message: t(pixKeyLabel ? 'errors.minTransferAmount' : 'errors.minQrAmount', {
                    amount: MIN_QR_PAYMENT_AMOUNT,
                }),
            }
        }
        if (!isAmountWithinBalance(usdAmount, balance)) {
            // gate on the displayed total; an in-transit shortfall passes here and
            // fails late with the settling message at execution. A locked amount
            // cannot be lowered here, so the copy says how much is missing.
            const message = paymentLock?.code
                ? tErrors('balanceShortBy', { amount: usdShortfall(paymentAmount, balance) })
                : tErrors('notEnoughBalanceAddFunds')
            return { message, shortOfBalance: true }
        }
        return null
    }, [
        isPixPay,
        pixPayMinimumBrl,
        pixPayment.amountRefusal,
        tPix,
        usdAmount,
        balance,
        paymentProcessor,
        paymentLock?.code,
        currency?.code,
        currencyAmount,
        pixKeyLabel,
        t,
        tErrors,
    ])
    const balanceErrorMessage = balanceError?.message ?? null

    // "Try again in a few seconds" is untrue once the refreshed balance cannot
    // cover the amount: the field error says what is short instead.
    const flowErrorMessage = isPixPay
        ? pixPayment.error
        : errorCode === 'balanceSettling' && balanceErrorMessage
          ? null
          : errorMessage

    // A Pix pay-route payment to the user's own account earns no points (API `selfPay`): no points line
    const shownPointsData = isPixPay && pixPayment.payment?.selfPay === true ? undefined : pointsData
    // Use points confetti hook for animation - must be called unconditionally
    usePointsConfetti(
        isSuccess && shownPointsData?.estimatedPoints ? shownPointsData.estimatedPoints : undefined,
        pointsDivRef
    )

    useEffect(() => {
        if (isSuccess) {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            // The commit: success state has rendered. Reported here, not where
            // setIsSuccess was called, so the stage means what it says.
            const telemetry = attemptTelemetryRef.current
            if (telemetry) {
                telemetry.stage('success_committed', { outcome: 'success' })
                telemetry.stage('attempt_finished', { outcome: 'success' })
            }
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
    // a payment this session is signing has no outcome yet: its review is on screen, not a loader
    const isLoadingPaymentData = isPixPay
        ? !currency ||
          (pixPayment.intentId && pixPayment.phase !== 'signing' ? !pixPayOutcome : pixPayment.isReadingCode)
        : (paymentProcessor === 'MANTECA' && !paymentLock) || !currency

    // Where a payment that is no longer on the form stands, for the status view.
    const paymentStatus: QrPaymentStatus | null = isPixPay
        ? pixPayOutcome && pixPayOutcome !== 'paid'
            ? PIX_PAY_STATUS[pixPayOutcome]
            : null
        : qrPayment
          ? qrPaymentDisplayStatus(qrPayment.status)
          : null

    // The API refused Pix for the user's residence although the app had let the scan through.
    const refusedForResidence =
        amountEntryRejection?.code === QR_INIT_CODE.PIX_RESIDENCE ||
        (scanOutcome.kind === 'failed' && scanOutcome.reason === QR_INIT_CODE.PIX_RESIDENCE)
    const view = deriveQrPayView({
        kycGateState,
        isProviderDisabled,
        // a residence that turns Brazil mid-payment leaves the submitted payment on screen
        isBrazilPaused:
            refusedForResidence || (isBrazilPaused && !submittedPaymentRef.current && loadingState !== 'Paying'),
        errorInitiatingPayment,
        waitingForMerchantAmount,
        showOrderNotReadyModal,
        isLoadingPaymentData,
        rateUnavailable,
        loadingState,
        isSuccess,
        hasUnsettledPayment: !!paymentStatus && paymentStatus !== 'completed',
        hasProcessor: !!paymentProcessor,
    })

    // The paid payment's reward, whatever the provider: the success view shows one reward UI
    const paidReward: PaidReward | null = useMemo(() => {
        if (isPixPay) {
            const payment = pixPayment.payment
            const perk = pixPaidPerk(payment)
            if (!payment || !pixPayment.intentId) return null
            return {
                paymentId: pixPayment.intentId,
                merchantName: payment.merchantName ?? undefined,
                perk: perk && pixRewardClaimed ? { ...perk, claimed: true } : perk,
            }
        }
        if (!qrPayment) return null
        return {
            paymentId: qrPayment.externalId,
            merchantName: qrPayment.details?.merchant?.name,
            perk: qrPayment.perk ?? null,
        }
    }, [isPixPay, pixPayment.payment, pixPayment.intentId, pixRewardClaimed, qrPayment])
    const markRewardClaimed = useCallback(() => {
        if (isPixPay) setPixRewardClaimed(true)
        else if (qrPayment?.perk) setQrPayment({ ...qrPayment, perk: { ...qrPayment.perk, claimed: true } })
    }, [isPixPay, qrPayment, setQrPayment])

    return {
        view,
        /** What the BRAZIL_PAUSED view says: the API's refusal for the residence, else the pay route's block. */
        pixPayBlock: refusedForResidence ? ('residence' as const) : qrPixBlock,
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
        errorMessage: flowErrorMessage,
        errorInitiatingPayment,
        initErrorNeedsSupport,
        initErrorNeedsVerification,
        isBlockingError,
        balanceErrorMessage,
        isShortOfBalance: !!balanceError?.shortOfBalance,
        rateUnavailable,
        retryRate,
        amountInputRevision,
        // controller-rotation quote handoff; on the Pix pay routes, a quote that moved before the signature
        quoteUpdatedNotice: isPixPay ? pixPayment.notice : quoteUpdatedNotice,
        isQuoteRecovering,
        cancelQuoteRecovery,
        // the wallet's spendable balance, surfaced here so views read ONE flow
        // object instead of re-calling useWallet next to it
        balance,
        usdAmount,
        merchantName,
        merchantTaxId,
        recipientBankName,
        providerFee,
        providerId,
        amountFixed,
        /** The rate row's figure where it differs from the field's price: Avenia's own rate, another pay-route provider's all-in rate. */
        shownRate,
        /** No rate row: Avenia's review names no rate of its own yet (`pixRateAndFee`). */
        hideRate,
        paymentStatus,
        /** A person at Peanut is looking at the payment: the status view offers support. */
        paymentNeedsSupport: isPixPay && pixPayOutcome === 'needs-support',
        /** Who was paid and the reais they got, for the success view. */
        paidTo: isPixPay
            ? (pixPayment.payment?.merchantName ?? pixPayMerchant?.merchantName ?? '')
            : (pixKeyOwner?.name ?? qrPayment?.details.merchant.name ?? paymentLock?.paymentRecipientName ?? ''),
        paidLocalAmount: isPixPay
            ? (pixPayment.payment?.amountBrl ?? pixPayReviewed?.amountBrl)
            : (qrPayment?.details.paymentAssetAmount ?? paymentLock?.paymentAssetAmount),
        /** The paid Pix pay-route payment's history entry: its receipt. */
        pixPayEntry: isPixPay ? (pixPayEntry ?? null) : null,
        pixKeyLabel,
        pixKeyOwner,
        isAwaitingPixKeyOwner,
        pixKeySave,
        // kyc gate
        gate,
        shouldBlockPay,
        // loading
        isLoading,
        loadingState,
        // points and the QR reward
        pointsData: shownPointsData,
        pointsDivRef,
        paidReward,
        markRewardClaimed,
        // actions
        onBack: onBackFromQrPay,
        payQR,
        handleCurrencyAmountChange,
        retryOrderNotReady,
    }
}

export type QrPayFlowSurface = ReturnType<typeof useQrPayFlowController>
