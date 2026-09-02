'use client'

import { railUserMessage, railVerdict } from '@/utils/capability-gate'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useState, useCallback, useMemo, useEffect, useContext, useRef } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { mantecaApi } from '@/services/manteca'
import type { QrPayment, QrPaymentLock } from '@/services/manteca'
import NavHeader from '@/components/Global/NavHeader'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'
import Loading from '@/components/Global/Loading'
import CyclingLoading from '@/components/Global/Loading/CyclingLoading'
import AmountInput from '@/components/Global/AmountInput'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { useStaleSessionGuard } from '@/hooks/wallet/useStaleSessionGuard'
import { SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { friendlyError } from '@/utils/friendly-error.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainCentsToUsdcUnits, isAmountWithinBalance } from '@/utils/balance.utils'
import { formatNumberForDisplay } from '@/utils/general.utils'
import { getShakeClass, type ShakeIntensity } from '@/utils/perk.utils'
import { calculateSavingsInCents, hasCardMarkupComparison } from '@/utils/qr-payment.utils'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'
import {
    MANTECA_QR_DEPOSIT_ADDRESS_AR,
    MANTECA_QR_DEPOSIT_ADDRESS_NON_AR,
    MANTECA_QR_INIT_SCAN_TIMEOUT_MS,
} from '@/constants/manteca.consts'
import { MIN_MANTECA_QR_PAYMENT_AMOUNT, MIN_PIX_AMOUNT_BRL } from '@/constants/payment.consts'
import { isPixRecurringCode } from '@/utils/withdraw.utils'
import { formatUnits, parseUnits } from 'viem'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { loadingStateContext } from '@/context/loadingStates.context'
import { loadingStateKey } from '@/i18n/app/loading-states'
import { getCurrencyPrice } from '@/app/actions/currency'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { wireErrorCode } from '@/services/api-error'
import { API_ERROR_CODES } from '@/services/api-error'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { isPaymentProcessorQR, EQrType, NAME_BY_QR_TYPE, type QrType } from '@/components/Global/DirectSendQR/utils'
import { QrKycState } from '@/constants/kyc.consts'
import ActionModal from '@/components/Global/ActionModal'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { cancelHaptic, notifyHaptic, vibrateHaptic } from '@/utils/haptics'
import { PeanutThinking } from '@/assets/mascot'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import { useAuth } from '@/context/authContext'
import { PointsAction } from '@/services/services.types'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { useModalsContext } from '@/context/ModalsContext'
import maintenanceConfig from '@/config/underMaintenance.config'
import PointsCard from '@/components/Common/PointsCard'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps, isBrUserEligibleForLimitIncrease } from '@/features/limits/utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSumsubActionFlow } from '@/hooks/useSumsubActionFlow'
import { initiateIncreaseLimits } from '@/app/actions/increase-limits'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useLimits } from '@/hooks/useLimits'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'

const MAX_QR_PAYMENT_AMOUNT = '2000'
const MIN_QR_PAYMENT_AMOUNT = '0.1'

// Deterministic provider rejections — retrying the payment-lock query can't
// change the outcome, so fail fast instead of burning the 3-attempt budget.
const NON_RETRYABLE_QR_PAY_ERRORS = [
    'PAYMENT_DESTINATION_DECODING_ERROR',
    // The cashier's charge timed out on the till. Only the cashier can clear it,
    // so retrying the same destination just burns the attempt budget.
    'PAYMENT_DESTINATION_EXPIRED',
    'PIX_MIN_AMOUNT',
    'PIX_RECURRING_NOT_SUPPORTED',
    // Missing auth header (AJV 400) — retrying sends the same headerless request,
    // so fail fast rather than waiting out three attempts.
    "required property 'authorization'",
    /*
     * Deterministic backend rejections from `/manteca/qr-payment/init`. None of
     * them can change between attempts inside one scan, and each retry re-runs
     * `createQrPaymentLock` against Manteca — so a capped user used to spend
     * four round trips and four abandoned price locks to be told something the
     * first response already knew. `mantecaApi.initiateQrPayment` throws the
     * response's `error` field, which is the bare code for the 422s and this
     * sentence for the KYC 400.
     */
    'MANTECA_SOURCE_OVER_MONTHLY_CAP',
    'MANTECA_MERCHANT_VOLUME_NEAR_CAP',
    'MANTECA_MERCHANT_RECENT_REFUND',
    'MANTECA_USER_NOT_PROVISIONED',
    'User KYC not approved',
]

/*
 * The same fail-fast set, keyed on the backend's stable wire discriminant
 * rather than its prose. Kept beside the message list because a rejection may
 * arrive with either — an older API build sends only the sentence.
 */
const NON_RETRYABLE_QR_PAY_CODES: string[] = [API_ERROR_CODES.MANTECA_KYC_REQUIRED]

type PaymentProcessor = 'MANTECA'

export default function QRPayPage() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const tLoading = useTranslations('loadingStates')
    const toFriendlyError = useFriendlyError()
    // Shown wherever the backend rejects a Pix payment below the rail minimum
    // (typed 400 PIX_MIN_AMOUNT — fires at lock-init for merchant-encoded amounts
    // and at re-init for user-entered amounts on open-amount QRs).
    const pixMinAmountErrorMessage = t('errors.pixMinAmount', { amount: MIN_PIX_AMOUNT_BRL })
    // PIX Automático (recurring) codes — rejected at the entry guard for scanned/pasted
    // deep links, and mapped from the backend's typed 400 PIX_RECURRING_NOT_SUPPORTED.
    const pixRecurringErrorMessage = t('errors.pixRecurring')
    const searchParams = useSearchParams()
    const router = useRouter()
    // QR-pay screens are terminal — leaving /qr-pay in history would let browser back from
    // /home pop the user back into a stale error / KYC screen. Replace instead of push.
    const onBack = useSafeBack('/home', { replace: true })
    const qrCode = decodeURIComponent(searchParams.get('qrCode') || '')
    const timestamp = searchParams.get('t')
    const qrType = searchParams.get('type')
    const { spendableBalance: balance } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const handleStaleSession = useStaleSessionGuard()
    const { overview: rainCardOverview } = useRainCardOverview()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessageRaw] = useState<string | null>(null)
    // Companion code for `errorMessage` so retry-vs-block logic compares a stable
    // identifier, never the localized string. Every set clears it unless a code
    // is passed explicitly.
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const setErrorMessage = useCallback((message: string | null, code: string | null = null) => {
        setErrorMessageRaw(message)
        setErrorCode(code)
    }, [])
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const [errorInitiatingPayment, setErrorInitiatingPayment] = useState<string | null>(null)
    const [paymentLock, setPaymentLock] = useState<QrPaymentLock | null>(null)
    const [showOrderNotReadyModal, setShowOrderNotReadyModal] = useState(false)
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
    const [currency, setCurrency] = useState<{ code: string; symbol: string; price: number } | undefined>(undefined)
    const { openTransactionDetails, isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)

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

    // MIGRATION-REVIEW: QR-pay KYC gate, formerly useQrKycGate + useKycStatus.
    // Derived inline from the backend capability model. Mapping:
    //   canDo('pay',{manteca}) → PROCEED_TO_PAY. The BE resolver expresses both
    //     paths uniformly as an enabled pay op: Sumsub-approved pool users AND
    //     Sumsub-approved US-nationality-restricted users alike (compliance
    //     ratified 2026-05-28). No FE special-case needed.
    //   manteca top-level 'blocked' → PROVIDER_REJECTION_BLOCKED (genuine block —
    //     no Sumsub, or a non-restriction final rejection).
    //   manteca top-level 'requires-info' → PROVIDER_REJECTION_FIXABLE.
    //   manteca 'pending' → IDENTITY_VERIFICATION_IN_PROGRESS.
    //   otherwise → REQUIRES_IDENTITY_VERIFICATION. While loading → LOADING.
    // userMessage ← the rejecting rail's reason.userMessage (was useProviderRejectionStatus).
    const { canDo, railsForProvider, nextActions, isKycApproved, isLoading: isLoadingCapabilities } = useCapabilities()
    const { user, fetchUser } = useAuth()

    // On public routes (qr-pay) auth still auto-fetches via React Query, but trigger a one-shot
    // fetch if we landed with no user and nothing in flight, mirroring the old hook's fallback.
    // `userFetchSettled` flips to true once the fallback fetch resolves (success OR fail) so the
    // memo below can keep the gate in LOADING until then — without it, the empty-capabilities
    // shape on a cold load would flash REQUIRES_IDENTITY_VERIFICATION for one paint.
    const hasRequestedUserFetchRef = useRef(false)
    const [userFetchSettled, setUserFetchSettled] = useState(false)
    useEffect(() => {
        if (!user && !isLoadingCapabilities && !hasRequestedUserFetchRef.current) {
            hasRequestedUserFetchRef.current = true
            void fetchUser().finally(() => setUserFetchSettled(true))
        }
    }, [user, isLoadingCapabilities, fetchUser])

    const { kycGateState, qrKycUserMessage, qrKycActionKey } = useMemo(() => {
        const noAction = null as string | null
        // Keep the gate in LOADING until either the user is hydrated OR the fallback
        // fetch has resolved. Otherwise we briefly map an empty capability shape onto
        // REQUIRES_IDENTITY_VERIFICATION for users whose auth state hasn't settled yet.
        if (isLoadingCapabilities || (!user && !userFetchSettled)) {
            return { kycGateState: QrKycState.LOADING, qrKycUserMessage: noAction, qrKycActionKey: noAction }
        }
        if (canDo('pay', { provider: 'manteca' })) {
            return { kycGateState: QrKycState.PROCEED_TO_PAY, qrKycUserMessage: noAction, qrKycActionKey: noAction }
        }
        // Verdict-first via the shared railVerdict collapse (rail.resolved,
        // BE-derived; legacy fallback for older/cached responses). The
        // US-nationality refinement is applied in the resolver itself
        // (Sumsub-approved + US-restricted → operations.pay enabled, caught by
        // canDo above), so a blocked verdict is genuine.
        const actionByKey = new Map(nextActions.map((action) => [action.key, action]))
        const candidates = railsForProvider('manteca').map((rail) => ({
            rail,
            verdict: railVerdict(rail, actionByKey),
        }))
        // provide-email is NOT a document fix: routing it into the Sumsub
        // upload flow dead-ends the user, and this surface has no email form —
        // map it to the blocked modal (same rule as deriveProviderRejection).
        const isProvideEmail = ({ verdict }: (typeof candidates)[number]) =>
            verdict.blocking?.selfHealKind === 'provide-email'
        const blocked = candidates.find(
            (candidate) => candidate.verdict.status === 'blocked' || isProvideEmail(candidate)
        )
        if (blocked) {
            // Country-not-supported is self-fixable: user uploaded a non-AR/BR doc
            // and can verify again with a different one. Split out for the right CTA.
            // (selfHealKind is the verdict home; the reason-code check covers legacy
            // responses — the code rides on blocking.code verbatim.)
            if (
                !isProvideEmail(blocked) &&
                (blocked.verdict.blocking?.selfHealKind === 'restart-identity' ||
                    blocked.verdict.blocking?.code === 'country_not_supported')
            ) {
                return {
                    kycGateState: QrKycState.PROVIDER_RESTART_IDENTITY,
                    qrKycUserMessage: railUserMessage(blocked.rail),
                    qrKycActionKey: noAction,
                }
            }
            return {
                kycGateState: QrKycState.PROVIDER_REJECTION_BLOCKED,
                qrKycUserMessage: railUserMessage(blocked.rail),
                qrKycActionKey: noAction,
            }
        }
        const fixable = candidates.find((candidate) => candidate.verdict.status === 'fixable')
        if (fixable) {
            const action = fixable.verdict.nextAction
            return {
                kycGateState: QrKycState.PROVIDER_REJECTION_FIXABLE,
                qrKycUserMessage: railUserMessage(fixable.rail),
                qrKycActionKey: action?.kind === 'sumsub' ? action.key : noAction,
            }
        }
        if (candidates.some(({ verdict }) => verdict.status === 'pending')) {
            return {
                kycGateState: QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS,
                qrKycUserMessage: noAction,
                qrKycActionKey: noAction,
            }
        }
        return {
            kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
            qrKycUserMessage: noAction,
            qrKycActionKey: noAction,
        }
    }, [isLoadingCapabilities, canDo, railsForProvider, nextActions, user, userFetchSettled])

    const shouldBlockPay = kycGateState !== QrKycState.PROCEED_TO_PAY

    const sumsubFlow = useMultiPhaseKycFlow({})

    // Auto-dismiss the Sumsub flow if the user's QR-pool rails become enabled
    // server-side while a flow is mid-air. Two known sources:
    //   1. The `/users/identity` LATAM re-entry path now calls
    //      `enableQrPoolRails()` BEFORE returning the Manteca action token
    //      (peanut-api-ts #920) — so the BE can hand back a Sumsub token AND
    //      have just unlocked QR access in the same request. Without this,
    //      the SDK pops on top of an already-unlocked user.
    //   2. Out-of-band capability updates (sibling-tab refresh, manual
    //      backfill, etc.) flip the gate to PROCEED_TO_PAY while the modal
    //      is still open. Same outcome — close it.
    // Cheap watcher, zero added latency on the happy path: relies on the
    // existing useUserAutoRefresh / fetchUser polling already in place.
    useEffect(() => {
        if (kycGateState !== QrKycState.PROCEED_TO_PAY) return
        if (sumsubFlow.showWrapper || sumsubFlow.isModalOpen) {
            sumsubFlow.completeFlow()
        }
        // Field-level deps are complete for this body. useMultiPhaseKycFlow returns a fresh
        // object each render, so depending on sumsubFlow itself would re-fire every render
        // and call completeFlow() repeatedly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kycGateState, sumsubFlow.showWrapper, sumsubFlow.isModalOpen, sumsubFlow.completeFlow])

    const queryClient = useQueryClient()
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const [perkClaimed, setPerkClaimed] = useState(false)
    const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false)
    const [holdProgress, setHoldProgress] = useState(0)
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const holdStartTimeRef = useRef<number | null>(null)
    const payingStateTimerRef = useRef<NodeJS.Timeout | null>(null)
    const { setIsSupportModalOpen, openSupportWithMessage: openSupportForLimits } = useModalsContext()
    const [waitingForMerchantAmount, setWaitingForMerchantAmount] = useState(false)
    const retryCount = useRef(0)

    // Analytics tracking refs (declared before resetState so it can clear them)
    const hasTrackedPerkShown = useRef(false)
    const perkClaimedRef = useRef(false)

    const resetState = () => {
        setIsSuccess(false)
        setErrorMessage(null)
        setBalanceErrorMessage(null)
        setErrorInitiatingPayment(null)
        setPaymentLock(null)
        setShowOrderNotReadyModal(false)
        setIsFirstLoad(true)
        setAmount(undefined)
        setCurrencyAmount(undefined)
        setQrPayment(null)
        setCurrency(undefined)
        setLoadingState('Idle')
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
        if (payingStateTimerRef.current) clearTimeout(payingStateTimerRef.current)
        holdStartTimeRef.current = null
        setHoldProgress(0)
        setIsShaking(false)
        setShakeIntensity('none')
        setWaitingForMerchantAmount(false)
        retryCount.current = 0
        // reset perk states
        setPerkClaimed(false)
        // reset analytics tracking refs so a new QR flow gets fresh tracking
        hasTrackedPerkShown.current = false
        perkClaimedRef.current = false
    }

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            if (payingStateTimerRef.current) clearTimeout(payingStateTimerRef.current)
            holdStartTimeRef.current = null
        }
    }, [])

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

    // Track reward claim shown + surprise moment when perk UI appears after payment
    useEffect(() => {
        perkClaimedRef.current = perkClaimed
    }, [perkClaimed])

    useEffect(() => {
        if (isSuccess && qrPayment?.perk?.eligible && !perkClaimed && !hasTrackedPerkShown.current) {
            hasTrackedPerkShown.current = true
            const eventProps = {
                amount_usd: qrPayment.perk.amountSponsored,
                discount_pct: qrPayment.perk.discountPercentage,
                merchant: qrPayment.details?.merchant?.name,
            }
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_SHOWN, eventProps)
            posthog.capture(ANALYTICS_EVENTS.SURPRISE_MOMENT_SHOWN, eventProps)
        }
    }, [isSuccess, qrPayment?.perk?.eligible, perkClaimed, qrPayment])

    // Track dismiss: user navigated away after seeing perk but without claiming
    useEffect(() => {
        return () => {
            if (hasTrackedPerkShown.current && !perkClaimedRef.current) {
                posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_DISMISSED)
            }
        }
    }, [])

    useEffect(() => {
        if (isSuccess || !!errorMessage) {
            setLoadingState('Idle')
        }
    }, [isSuccess, errorMessage, setLoadingState])

    // First fetch for qrcode info — only after KYC gating allows proceeding
    useEffect(() => {
        resetState()

        // Before isPaymentProcessorQR: recurrence codes can match PIX_REGEX, and the
        // specific message must win over the generic "Invalid QR code scanned".
        if (qrCode && isPixRecurringCode(qrCode)) {
            setErrorInitiatingPayment(pixRecurringErrorMessage)
            return
        }

        if (!qrCode || !isPaymentProcessorQR(qrCode)) {
            setErrorInitiatingPayment(t('errors.invalidQr'))
            return
        }

        setIsFirstLoad(false)
        // Keyed on the scan (timestamp/processor/qrCode) on purpose: this resets payment
        // state for each new QR. resetState is a render-body function and t/
        // pixRecurringErrorMessage derive from it, so including them would re-run the
        // reset on every render and wipe the amount mid-entry.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timestamp, paymentProcessor, qrCode])

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
    }, [paymentLock, paymentProcessor])

    // Get currency object from payment lock (Manteca)
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return
        if (!paymentLock) return
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
        getCurrencyObject().then(setCurrency)
    }, [paymentLock, paymentProcessor])

    const isBlockingError = useMemo(() => {
        // The settling failure says "try again in a few seconds" — keep the Pay
        // button enabled so the user can retry, don't dead-end it like a hard error.
        return !!errorMessage && errorCode !== 'confirmTransaction' && errorCode !== 'balanceSettling'
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

    // Live card-vs-local-rail markup, driven by Manteca's rate + (for ARS)
    // BCRA's official rate. Used by both the confirm-screen "Save vs card"
    // row and the success-screen savings message — keeps them in sync.
    const { data: cardMarkup } = useCardMarkupRate(currency?.code, currency?.price)

    // validate payment against user's limits
    // currency comes from payment lock — hook normalizes it internally
    const limitsValidation = useLimitsValidation({
        flowType: 'qr-payment',
        amount: usdAmount,
        currency: currency?.code,
    })

    // BR self-service limit increase flow
    const { mantecaLimits: qrMantecaLimits, refetch: refetchQrLimits } = useLimits()
    const isBrQrEligible = isBrUserEligibleForLimitIncrease(qrMantecaLimits)
    const qrLimitIncreaseFlow = useSumsubActionFlow({
        fetchToken: initiateIncreaseLimits,
        onSuccess: refetchQrLimits,
        onNeedsSupport: () => openSupportForLimits('Hi, I would like to increase my payment limits.'),
    })

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

    // receipt transaction for the success drawer — built up-front (not in the
    // cta's onClick) because the drawer opens off the url's `?tx=` match.
    const receiptTransaction: TransactionDetails | null = useMemo(() => {
        if (!qrPayment || !currency) return null
        const now = new Date()
        return {
            // Manteca synthetic id — the only key /receipt/<id>
            // resolves, and what Activity rows already carry.
            // `externalId` is UUID-shaped, so it slips past the
            // id-shape gate and 404s silently instead of erroring.
            id: qrPayment.id,
            direction: 'qr_payment',
            userName: qrPayment.details.merchant.name,
            fullName: qrPayment.details.merchant.name,
            amount: Number(usdAmount),
            currency: {
                amount: qrPayment.details.paymentAssetAmount,
                code: currency.code,
            },
            initials: 'QR',
            currencySymbol: currency.symbol,
            status: 'completed',
            date: now,
            createdAt: now,
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'QR_PAY',
                provider: 'MANTECA',
                avatarUrl: methodIcon,
                receipt: {
                    exchange_rate: currency.price.toString(),
                },
            },
            totalAmountCollected: Number(usdAmount),
        }
    }, [qrPayment, currency, usdAmount, methodIcon])

    // Fetch Manteca payment lock immediately on QR scan (Manteca only)
    // OPTIMIZATION: We fetch payment details BEFORE KYC check completes for faster UX
    // This is SAFE because:
    // 1. We only fetch payment metadata (merchant info, amount) - no sensitive action
    // 2. The actual payment action is blocked by shouldBlockPay (line 713 & 1109)
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
                { qrCode, qrType: qrType ?? undefined },
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
            // Don't retry provider-specific errors
            if (NON_RETRYABLE_QR_PAY_ERRORS.some((code) => error?.message?.includes(code))) {
                return false
            }
            /*
             * The wire code as well as the prose. The KYC 400's stable
             * discriminant is its `code`; its `error` is an English sentence.
             * Matching only the message meant a reworded rejection still
             * scheduled three more POSTs behind the (correct) KYC copy the
             * result effect had already shown.
             */
            const wireCode = wireErrorCode(error)
            if (wireCode && NON_RETRYABLE_QR_PAY_CODES.includes(wireCode)) {
                return false
            }
            // Three retries on top of the first attempt (see the note above).
            return failureCount < 3
        },
        retryDelay: 3000,
        staleTime: 0, // Always fetch fresh data
        gcTime: 0, // Don't cache for garbage collection
    })

    // Handle payment lock fetch results
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return

        if (isLoadingPaymentLock && !paymentLockFailureReason) {
            setLoadingState('Fetching details')
            return
        }

        if (fetchedPaymentLock && !paymentLock) {
            setPaymentLock(fetchedPaymentLock)
            setWaitingForMerchantAmount(false)
            setLoadingState('Idle')
            /*
             * A lock in hand outranks any earlier failure. Offline pauses the
             * query and shows the error, but the query stays resumable — so
             * without this a scan that recovered on reconnect had its payment
             * screen hidden behind a latched outage message it could never
             * clear. `errorInitiatingPayment` gates the render at the top.
             */
            setErrorInitiatingPayment(null)
        }

        const error = paymentLockError ?? paymentLockFailureReason
        if (error) {
            /*
             * `failureReason` carries the FIRST failure, which for a retryable
             * one arrives with three attempts still to come. The provider
             * rejections below are all non-retryable, so acting on them
             * immediately is correct and stays as it was; a network failure is
             * not yet an outcome, and `paymentLockError` — set only once the
             * query settles — is what separates the two.
             *
             * A PAUSED query is not pending either. Under react-query's default
             * `networkMode: 'online'` a device that drops offline mid-retry
             * parks the query: no fetch is in flight, so no AbortController
             * ever fires and `paymentLockError` is never set. Without this the
             * scan would sit on the retry caption forever, with no outcome and
             * no way out — worse than the premature error it replaced.
             */
            const retriesPending = !paymentLockError && paymentLockFetchStatus !== 'paused'
            setLoadingState('Idle')

            // Provider-specific errors: show appropriate message
            if (error.message.includes('PAYMENT_DESTINATION_MISSING_AMOUNT')) {
                setWaitingForMerchantAmount(true)
            } else if (error.message.includes('PAYMENT_DESTINATION_DECODING_ERROR')) {
                // Pix has no fallback rail in Brazil — ask the merchant to regenerate.
                // For Argentina (MERCADO_PAGO and ARGENTINA_QR3), MP is the dominant
                // rail, so suggesting an MP QR is the most useful fallback.
                setErrorInitiatingPayment(qrType === EQrType.PIX ? t('errors.pixDecode') : t('errors.genericDecode'))
                posthog.capture(ANALYTICS_EVENTS.QR_DECODING_ERROR_SHOWN, { qr_type: qrType })
                setWaitingForMerchantAmount(false)
            } else if (error.message.includes('PAYMENT_DESTINATION_EXPIRED')) {
                // The QR is fine — a static POS sticker never expires. The charge
                // the cashier rang up on the till did. Name the cashier action
                // instead of blaming the rail.
                setErrorInitiatingPayment(t('errors.merchantChargeExpired'))
                posthog.capture(ANALYTICS_EVENTS.QR_MERCHANT_CHARGE_EXPIRED_SHOWN, { qr_type: qrType })
                setWaitingForMerchantAmount(false)
            } else if (error.message.includes('PIX_MIN_AMOUNT')) {
                // Deterministic rejection — the merchant-encoded amount is below
                // the rail minimum, so there's no merchant amount to wait for.
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(pixMinAmountErrorMessage)
            } else if (error.message.includes('PIX_RECURRING_NOT_SUPPORTED')) {
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(pixRecurringErrorMessage)
            } else if (error.message.includes("required property 'authorization'")) {
                // Session token wasn't attached to the request (not a provider
                // outage) — surface an honest, retryable message instead of
                // blaming the payment rail.
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(t('errors.authError'))
            } else if (error.message.includes('MANTECA_SOURCE_OVER_MONTHLY_CAP')) {
                /*
                 * The user's own limit, not an outage — product/providers/fiat/
                 * README.md records a capped user blocked for three days behind
                 * "unexpected error". The copy leads with a smaller amount
                 * because the backend blocks when THIS payment exceeds the
                 * remaining headroom (`attempted <= available` in cap-check.ts),
                 * not when the headroom is gone, and names the shared pool
                 * because the cap spans deposits and withdrawals too (kyc.md).
                 */
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(t('errors.monthlyCapReached'))
            } else if (
                error.message.includes('MANTECA_MERCHANT_VOLUME_NEAR_CAP') ||
                error.message.includes('MANTECA_MERCHANT_RECENT_REFUND')
            ) {
                // A limit on the MERCHANT, so naming the user's own limit would
                // be wrong — and so would blaming the rail.
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(t('errors.merchantNotAvailable'))
            } else if (
                wireErrorCode(error) === API_ERROR_CODES.MANTECA_KYC_REQUIRED ||
                error.message.includes('MANTECA_USER_NOT_PROVISIONED') ||
                error.message.includes('User KYC not approved')
            ) {
                // Actionable and the user's to resolve. Matched on the wire code
                // first so a backend rewording of the prose cannot silently send
                // this back to the retry-then-outage path.
                setWaitingForMerchantAmount(false)
                setErrorInitiatingPayment(t('errors.kycRequired'))
            } else if (retriesPending) {
                /*
                 * Retryable network/timeout failure with attempts left. The
                 * terminal copy used to land here, contradicting what the query
                 * was still doing: a scan that recovered on attempt 2 had
                 * already told the user the rail was down. Say we are still
                 * trying, and let the branch below own the outcome.
                 */
                setLoadingState('Still fetching details')
                setWaitingForMerchantAmount(false)
            } else {
                // Network/timeout errors after all retries exhausted
                setErrorInitiatingPayment(
                    t('errors.providerIssues', { method: (qrType && NAME_BY_QR_TYPE[qrType as QrType]) || 'QR' })
                )
                setWaitingForMerchantAmount(false)
            }
        }
    }, [
        fetchedPaymentLock,
        isLoadingPaymentLock,
        paymentLockError,
        paymentLockFailureReason,
        paymentLock,
        qrType,
        paymentProcessor,
        setLoadingState,
        t,
        pixMinAmountErrorMessage,
        pixRecurringErrorMessage,
    ])

    const merchantName = useMemo(() => {
        if (!paymentLock) return null
        return paymentLock.paymentRecipientName
    }, [paymentLock])

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
                })
                setPaymentLock(finalPaymentLock)
            } catch (error) {
                if (error instanceof Error && error.message.includes('PIX_MIN_AMOUNT')) {
                    // Deterministic rejection (user-entered amount below the rail
                    // minimum) — actionable copy, not a Sentry-worthy surprise.
                    setErrorMessage(pixMinAmountErrorMessage)
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
                // Per-rail Manteca QR funding wallet: Pix → non-AR, everything else → AR
                // (same binary heuristic as the backend's getQrReceiveAddress).
                recipient: qrType === EQrType.PIX ? MANTECA_QR_DEPOSIT_ADDRESS_NON_AR : MANTECA_QR_DEPOSIT_ADDRESS_AR,
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
            const qrPayment = await mantecaApi.completeQrPaymentWithSignedTx(requestBody)
            // clear the timer since we got a response
            if (payingStateTimerRef.current) {
                clearTimeout(payingStateTimerRef.current)
                payingStateTimerRef.current = null
            }
            // Map backend field name (sponsoredUsd) to frontend field name (amountSponsored)
            const perkResponse = qrPayment.perk as Record<string, unknown> | undefined
            if (qrPayment.perk && typeof perkResponse?.sponsoredUsd === 'number') {
                qrPayment.perk.amountSponsored = perkResponse.sponsoredUsd
            }

            setQrPayment(qrPayment)

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
        setLoadingState,
        qrType,
        handleStaleSession,
        t,
        toFriendlyError,
        setErrorMessage,
        pixMinAmountErrorMessage,
    ])

    const payQR = useCallback(async () => {
        if (paymentProcessor === 'MANTECA') {
            await handleMantecaPayment()
        }
    }, [paymentProcessor, handleMantecaPayment])

    // DEV NOTE: This is an OPTIMISTIC claim flow for better UX
    // We immediately show success UI and trigger confetti, then claim in background
    // If claim fails, we show error post-factum but keep the user in success state
    const claimPerk = useCallback(() => {
        if (!qrPayment?.externalId) return

        // 1. IMMEDIATELY show success UI (optimistic)
        setPerkClaimed(true)

        // 2. Reset shake and show success with confetti RIGHT AWAY
        setIsShaking(false)
        setShakeIntensity('none')
        setHoldProgress(0)

        // 3. Final success haptic feedback - POWERFUL celebratory double pulse!
        notifyHaptic('success')

        // 4. Trigger confetti immediately
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })

        // 5. Surface the reward. The perk was already issued AND claimed
        //    server-side during QR-payment processing, and qrPayment.perk
        //    already carries the sponsored amount from that response — so mark
        //    it claimed and report it directly. (The old /perks/claim round-trip
        //    took a mantecaTransferId the endpoint no longer accepts — it now
        //    requires a usageId the client never has — so it always 400'd: pure
        //    Sentry noise, and REWARD_CLAIMED never fired because it lived in the
        //    never-reached success branch. The error it set was invisible here —
        //    the success screen doesn't render errorMessage.)
        const claimedPerk = qrPayment.perk
        if (claimedPerk) {
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIMED, {
                amount_usd: claimedPerk.amountSponsored,
                discount_pct: claimedPerk.discountPercentage,
            })
            setQrPayment({ ...qrPayment, perk: { ...claimedPerk, claimed: true } })
        }
    }, [qrPayment])

    // Hold-to-claim mechanics
    const cancelHold = useCallback(() => {
        const PREVIEW_DURATION_MS = 500

        // Calculate how long the user held
        const elapsed = holdStartTimeRef.current ? Date.now() - holdStartTimeRef.current : 0

        // Clear the completion timer (we'll never complete on release)
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null

        // If it was a quick tap, let the preview animation continue for 500ms before resetting
        if (elapsed > 0 && elapsed < PREVIEW_DURATION_MS) {
            const remainingPreviewTime = PREVIEW_DURATION_MS - elapsed

            // Let animations continue for the preview duration
            const resetTimer = setTimeout(() => {
                // Clean up after preview
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
                setHoldProgress(0)
                setIsShaking(false)
                setShakeIntensity('none')
                holdStartTimeRef.current = null

                cancelHaptic()
            }, remainingPreviewTime)

            holdTimerRef.current = resetTimer
        } else {
            // Released after preview duration - reset immediately
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
            setHoldProgress(0)
            setIsShaking(false)
            setShakeIntensity('none')
            holdStartTimeRef.current = null

            cancelHaptic()
        }
    }, [])

    const startHold = useCallback(() => {
        setHoldProgress(0)
        setIsShaking(true)

        const startTime = Date.now()
        holdStartTimeRef.current = startTime
        let lastIntensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'

        // Update progress and shake intensity
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / PERK_HOLD_DURATION_MS) * 100, 100)
            setHoldProgress(progress)

            // Progressive shake intensity with haptic feedback
            let newIntensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'
            if (progress < 25) {
                newIntensity = 'weak'
            } else if (progress < 50) {
                newIntensity = 'medium'
            } else if (progress < 75) {
                newIntensity = 'strong'
            } else {
                newIntensity = 'intense'
            }

            // Trigger haptic feedback when intensity changes
            if (newIntensity !== lastIntensity) {
                // Progressive vibration patterns that match shake intensity - MAX STRENGTH!
                switch (newIntensity) {
                    case 'weak':
                        vibrateHaptic(50) // Short but noticeable pulse
                        break
                    case 'medium':
                        vibrateHaptic([100, 40, 100]) // Medium pulse pattern
                        break
                    case 'strong':
                        vibrateHaptic([150, 40, 150, 40, 150]) // Strong pulse pattern
                        break
                    case 'intense':
                        vibrateHaptic([200, 40, 200, 40, 200, 40, 200]) // INTENSE pulse pattern
                        break
                }
                lastIntensity = newIntensity
            }

            setShakeIntensity(newIntensity)

            if (progress >= 100) {
                clearInterval(interval)
            }
        }, 50)

        progressIntervalRef.current = interval

        // Complete after hold duration
        const timer = setTimeout(() => {
            claimPerk()
        }, PERK_HOLD_DURATION_MS)

        holdTimerRef.current = timer
    }, [claimPerk])

    // Check user balance and payment limits
    useEffect(() => {
        if (!usdAmount || usdAmount === '0.00' || isNaN(Number(usdAmount)) || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)

        // Manteca-specific validation (PIX, MercadoPago, QR3)
        if (paymentProcessor === 'MANTECA') {
            if (paymentAmount < parseUnits(MIN_MANTECA_QR_PAYMENT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
                setBalanceErrorMessage(t('errors.minMantecaAmount', { amount: MIN_MANTECA_QR_PAYMENT_AMOUNT }))
                return
            }
            // PIX rail enforces a 1 BRL minimum, stricter than the USD floor above
            if (currency?.code === 'BRL' && currencyAmount && parseFloat(currencyAmount) < MIN_PIX_AMOUNT_BRL) {
                setBalanceErrorMessage(t('errors.minPixAmountBrl', { amount: MIN_PIX_AMOUNT_BRL }))
                return
            }
        }

        // Common validations for all payment processors
        if (paymentAmount > parseUnits(MAX_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(t('errors.maxQrAmount', { amount: MAX_QR_PAYMENT_AMOUNT }))
        } else if (paymentAmount < parseUnits(MIN_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(t('errors.minQrAmount', { amount: MIN_QR_PAYMENT_AMOUNT }))
        } else if (!isAmountWithinBalance(usdAmount, balance)) {
            // gate on the displayed total; an in-transit shortfall passes here and
            // fails late with the settling message at execution.
            setBalanceErrorMessage(tErrors('notEnoughBalanceAddFunds'))
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance, paymentProcessor, currency?.code, currencyAmount, t, tErrors])

    // Use points confetti hook for animation - must be called unconditionally
    usePointsConfetti(isSuccess && pointsData?.estimatedPoints ? pointsData.estimatedPoints : undefined, pointsDivRef)

    useEffect(() => {
        if (isSuccess) {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [isSuccess, queryClient])

    useEffect(() => {
        if (waitingForMerchantAmount && !isLoadingPaymentLock) {
            setWaitingForMerchantAmount(false)
            setShowOrderNotReadyModal(true)
        }
    }, [waitingForMerchantAmount, isLoadingPaymentLock])

    const isLoadingKycState = kycGateState === QrKycState.LOADING

    // get user-facing payment method name for maintenance screen
    // NOTE: must be above early returns to comply with React's Rules of Hooks
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

    // only show KYC modals after KYC state has loaded
    // explicitly check for KYC states that require blocking (not PROCEED_TO_PAY)
    // important: this check must come BEFORE errorInitiatingPayment check
    // because unverified users should see KYC screen, not error screen
    const needsKycVerification =
        kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION ||
        kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS
    const hasProviderRejection =
        kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE ||
        kycGateState === QrKycState.PROVIDER_REJECTION_BLOCKED ||
        kycGateState === QrKycState.PROVIDER_RESTART_IDENTITY

    // show loading while KYC state is being determined
    if (isLoadingKycState) {
        return <Loading variant="mascot" />
    }

    // provider rejection: user is sumsub-approved but manteca rejected
    if (hasProviderRejection) {
        const isFixable = kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE
        const isRestartIdentity = kycGateState === QrKycState.PROVIDER_RESTART_IDENTITY
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title={tNav('pay')} />
                <ActionModal
                    visible
                    onClose={onBack}
                    title={
                        isFixable
                            ? t('kyc.fixableTitle')
                            : isRestartIdentity
                              ? t('kyc.restartTitle')
                              : t('kyc.blockedTitle')
                    }
                    description={
                        isFixable
                            ? t('kyc.fixableDescription')
                            : isRestartIdentity
                              ? (qrKycUserMessage ?? t('kyc.restartDescription'))
                              : (qrKycUserMessage ?? t('kyc.blockedDescription'))
                    }
                    icon={
                        methodIcon ? (
                            <Image src={methodIcon} alt={t('paymentMethodAlt')} width={48} height={48} priority />
                        ) : undefined
                    }
                    ctas={[
                        isFixable
                            ? {
                                  text: t('kyc.uploadDocument'),
                                  onClick: () =>
                                      sumsubFlow.handleFixableRejection({
                                          provider: 'MANTECA',
                                          actionKey: qrKycActionKey,
                                      }),
                                  variant: 'purple' as const,
                                  shadowSize: '4' as const,
                                  icon: 'upload-cloud' satisfies IconName,
                              }
                            : isRestartIdentity
                              ? {
                                    text: t('kyc.restartTitle'),
                                    onClick: () => sumsubFlow.handleRestartIdentity(),
                                    variant: 'purple' as const,
                                    shadowSize: '4' as const,
                                    icon: 'upload-cloud' satisfies IconName,
                                }
                              : {
                                    text: tCommon('contactSupport'),
                                    onClick: () => setIsSupportModalOpen(true),
                                    variant: 'stroke' as const,
                                },
                    ]}
                />
                <SumsubKycModals flow={sumsubFlow} />
            </div>
        )
    }

    // show KYC screens before any error screens - user needs to verify first
    // MIGRATION-REVIEW: the `crossRegion` flag passed to handleInitiateKyc was `isUserSumsubKycApproved`
    // (Sumsub identity cleared, only the regional Manteca uplift remains). Sumsub has no rail in the
    // capability model, so — matching the MantecaFlowManager precedent (commit 8c98a3e81) — isKycApproved
    // (any enabled rail ⇒ identity verified at least once) is the closest faithful proxy.
    if (needsKycVerification) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title={tNav('pay')} />
                <ActionModal
                    visible={kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION}
                    onClose={onBack}
                    title={t('kyc.unlockTitle')}
                    description={t('kyc.unlockDescription')}
                    icon={
                        methodIcon ? (
                            <Image src={methodIcon} alt={t('paymentMethodAlt')} width={48} height={48} priority />
                        ) : undefined
                    }
                    ctas={[
                        {
                            text: t('kyc.unlockCta'),
                            onClick: () =>
                                sumsubFlow.handleInitiateKyc(
                                    'LATAM',
                                    undefined,
                                    isKycApproved || undefined,
                                    targetMantecaCountry
                                ),
                            variant: 'purple',
                            shadowSize: '4',
                            icon: 'check-circle',
                        },
                    ]}
                    footer={<PeanutDoesntStoreAnyPersonalInformation />}
                />
                <ActionModal
                    visible={kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS}
                    onClose={onBack}
                    title={t('kyc.inProgressTitle')}
                    description={t('kyc.inProgressDescription')}
                    icon="shield"
                    ctas={[
                        {
                            text: tCommon('continue'),
                            onClick: () =>
                                sumsubFlow.handleInitiateKyc(
                                    'LATAM',
                                    undefined,
                                    isKycApproved || undefined,
                                    targetMantecaCountry
                                ),
                            variant: 'purple',
                            shadowSize: '4',
                            icon: 'check-circle',
                        },
                        {
                            text: t('kyc.notNow'),
                            onClick: onBack,
                            variant: 'transparent',
                            className: 'underline text-body-s w-full h-fit mt-3',
                        },
                    ]}
                />
                <SumsubKycModals flow={sumsubFlow} />
            </div>
        )
    }

    // Show maintenance error if provider is disabled
    if (isProviderDisabled) {
        return (
            <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center">
                <Card className="flex w-full flex-col items-center gap-2 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="alert" size={24} />
                    </div>
                    <span className="text-heading-card">{t('maintenance.title')}</span>
                    <p className="text-center font-normal text-foreground-secondary">
                        {t('maintenance.description', { method: paymentMethodName })}
                    </p>
                </Card>
                <Button onClick={onBack} variant="purple" shadowSize="4">
                    {t('maintenance.goBack')}
                </Button>
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
                    {t('havingTrouble')}
                </button>
            </div>
        )
    }

    if (!!errorInitiatingPayment) {
        return (
            <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="alert" size={24} />
                    </div>
                    <p className="font-medium"> {errorInitiatingPayment || t('errors.genericQrDetails')}</p>

                    <Button onClick={onBack} variant="purple">
                        {t('maintenance.goBack')}
                    </Button>
                </Card>
            </div>
        )
    }

    // check if we're still loading payment data before showing anything
    const isLoadingPaymentData = isFirstLoad || (paymentProcessor === 'MANTECA' && !paymentLock) || !currency

    if (waitingForMerchantAmount) {
        return <QrPayPageLoading message={t('waitingForMerchant')} />
    }

    if (showOrderNotReadyModal) {
        return (
            <div className="my-auto space-y-4 flex h-full w-full flex-col justify-center">
                <Card className="flex w-full flex-col items-center gap-2 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="qr-code" size={24} />
                    </div>
                    <span className="text-heading-card">{t('orderNotReady.title')}</span>
                    <p className="max-w-52 text-center font-normal text-foreground-secondary">
                        {t('orderNotReady.description')}
                    </p>
                </Card>
                <Button
                    onClick={() => {
                        // Merchant likely entered the amount on their POS between
                        // scans, so a fresh fetch with the same URL succeeds.
                        setShowOrderNotReadyModal(false)
                        void refetchPaymentLock()
                    }}
                    variant="purple"
                    shadowSize="4"
                >
                    {t('orderNotReady.cta')}
                </Button>
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
                    {t('havingTrouble')}
                </button>
            </div>
        )
    }

    // show loading spinner if we're still loading payment data
    if (isLoadingPaymentData || loadingState === 'Paying') {
        if (loadingState === 'Paying') return <CyclingLoading />
        /*
         * Captioned only for the retry window. A scan being retried after a
         * stalled request is otherwise pixel-identical to a slow first attempt,
         * and it is the silent spinner that sends people to ask the cashier.
         * Every other state keeps the bare mascot it has always had.
         */
        if (loadingState === 'Still fetching details') {
            return <QrPayPageLoading message={tLoading(loadingStateKey(loadingState))} />
        }
        return <Loading variant="mascot" />
    }

    //Success
    if (isSuccess && paymentProcessor === 'MANTECA' && !qrPayment) {
        return null
    } else if (isSuccess && paymentProcessor === 'MANTECA') {
        // Show "saved $X vs card" only for currencies with a meaningful
        // card-vs-local-rail gap (ARS, BRL — see CARD_FX_MARKUP_BY_CURRENCY).
        // Rate is live (BCRA for ARS) via useCardMarkupRate above.
        const savingsInCents = calculateSavingsInCents(usdAmount, cardMarkup?.rate)
        const showSavingsMessage = savingsInCents > 0 && hasCardMarkupComparison(currency?.code)
        // < $1 reads in cents, otherwise in dollars — same split the old English-only util made
        const savingsMessage = showSavingsMessage
            ? savingsInCents < 100
                ? t('success.savedVsCardCents', { count: savingsInCents })
                : t('success.savedVsCardDollars', {
                      amount: formatNumberForDisplay((savingsInCents / 100).toString(), { maxDecimals: 2 }),
                  })
            : ''

        const rewardClaimable = !!qrPayment?.perk?.eligible && !perkClaimed && !qrPayment.perk.claimed

        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <SoundPlayer sound="success" />
                <NavHeader title={tNav('pay')} />
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    {/* Only show payment card if reward was not claimed */}
                    {!perkClaimed && !qrPayment?.perk?.claimed && (
                        <Card className="flex flex-row items-center gap-3 p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={
                                        'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-green-500 font-bold'
                                    }
                                >
                                    <Icon name="check" size={24} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h1 className="text-body-s font-normal text-foreground-secondary">
                                    {t('success.youPaid', {
                                        merchant:
                                            qrPayment?.details.merchant.name ?? paymentLock?.paymentRecipientName ?? '',
                                    })}
                                </h1>
                                <div className="text-heading-s">
                                    {currency.symbol}{' '}
                                    {formatNumberForDisplay(
                                        qrPayment?.details.paymentAssetAmount ?? paymentLock?.paymentAssetAmount,
                                        { maxDecimals: 2 }
                                    )}
                                </div>
                                <div className="text-heading-card">
                                    ≈ {formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })} USD
                                </div>
                                {/* Savings Message (Argentina Manteca only) */}
                                {showSavingsMessage && savingsMessage && (
                                    <p className="text-body-s text-foreground-secondary italic">{savingsMessage}</p>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Reward Eligibility Card - Show before claiming */}
                    {rewardClaimable && (
                        <Card ref={pointsDivRef} className="flex items-start gap-3 bg-white p-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                                <Image src={STAR_STRAIGHT_ICON} alt="star" width={24} height={24} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-heading-card">{t('success.earnedRewardTitle')}</h2>
                                <p className="text-body-s">
                                    {(() => {
                                        const amountSponsored = qrPayment?.perk?.amountSponsored
                                        if (amountSponsored && typeof amountSponsored === 'number') {
                                            return t('success.earnedHoldToClaim', {
                                                amount: amountSponsored.toFixed(2),
                                            })
                                        }

                                        return t('success.holdToClaim')
                                    })()}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Reward Success Banner - Show after claiming */}
                    {(perkClaimed || qrPayment?.perk?.claimed) && (
                        <Card className="flex items-start gap-3 bg-white p-4">
                            <div className="flex max-w-[15%] flex-shrink-0 items-center justify-center rounded-full p-2">
                                <Image src={STAR_STRAIGHT_ICON} alt="star" width={28} height={28} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-heading-s">{t('success.earnedRewardTitle')}</h2>
                                <p className="text-body-m">
                                    {(() => {
                                        const amountSponsored = qrPayment?.perk?.amountSponsored

                                        if (amountSponsored && typeof amountSponsored === 'number') {
                                            return t('success.earnedInviteFriends', {
                                                amount: amountSponsored.toFixed(2),
                                            })
                                        }

                                        return t('success.inviteFriends')
                                    })()}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Points Display - ref used for confetti origin point */}
                    {!qrPayment?.perk?.eligible && pointsData?.estimatedPoints && (
                        <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                    )}

                    <div className="space-y-4 w-full">
                        {/* Show Claim Reward button if eligible and not claimed yet */}
                        {rewardClaimable ? (
                            <Button
                                onPointerDown={startHold}
                                onPointerUp={cancelHold}
                                onPointerLeave={cancelHold}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        startHold()
                                    }
                                }}
                                onKeyUp={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        cancelHold()
                                    }
                                }}
                                onContextMenu={(e) => {
                                    // Prevent context menu from appearing
                                    e.preventDefault()
                                }}
                                shadowSize="4"
                                className="relative touch-manipulation overflow-hidden select-none"
                                style={{
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                            >
                                {/* progress fill from left to right */}
                                <div
                                    className="absolute inset-0 bg-black transition-all duration-instant"
                                    style={{
                                        width: `${holdProgress}%`,
                                        left: 0,
                                    }}
                                />
                                {(() => {
                                    const label = t('success.claimReward')
                                    return (
                                        <>
                                            <span className="relative z-10">{label}</span>
                                            <span
                                                className="absolute inset-0 z-20 flex items-center justify-center text-white transition-all duration-instant"
                                                style={{ clipPath: `inset(0 ${100 - holdProgress}% 0 0)` }}
                                            >
                                                {label}
                                            </span>
                                        </>
                                    )
                                })()}
                            </Button>
                        ) : (
                            <>
                                {/* after claiming a reward, primary CTA is "Done" — not "Split this bill" */}
                                {perkClaimed || qrPayment?.perk?.claimed ? (
                                    <Button shadowSize="4" onClick={() => router.push('/home')}>
                                        {tCommon('goToHome')}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => {
                                            const params = new URLSearchParams({
                                                amount: String(usdAmount ?? ''),
                                                merchant: qrPayment!.details.merchant.name,
                                            })
                                            router.push(`/request?${params.toString()}`)
                                        }}
                                        icon="users"
                                        shadowSize="4"
                                    >
                                        {t('success.splitThisBill')}
                                    </Button>
                                )}
                                <Button
                                    variant="primary-soft"
                                    shadowSize="4"
                                    disabled={false}
                                    onClick={() => {
                                        if (receiptTransaction) {
                                            openTransactionDetails(receiptTransaction)
                                        }
                                    }}
                                >
                                    {t('success.seeReceipt')}
                                </Button>
                            </>
                        )}

                        {/* Underlined text, not a button, so the stack stays at two filled
                            CTAs. Not gated on isActivated (the receipt nudge is): on a first
                            QR pay that flag is still false server-side. Hidden while a reward
                            is claimable so it cannot compete with the hold-to-claim gesture. */}
                        {user?.user.username && !rewardClaimable && (
                            <button
                                onClick={() => setShowInviteFriendsModal(true)}
                                className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary underline transition-colors hover:text-black"
                            >
                                <Icon name="invite-heart" size={16} className="text-foreground-secondary" />
                                {t('success.inviteFriendsCta')}
                            </button>
                        )}
                    </div>
                </div>
                <TransactionDetailsDrawer
                    isOpen={isTransactionSelected(receiptTransaction?.id)}
                    onClose={closeTransactionDetails}
                    transaction={receiptTransaction}
                />
                {/* Mounted only while open: the modal's shown-guard is a ref that lives
                    for the mount, so a persistent mount would swallow the MODAL_SHOWN /
                    REFERRAL_CTA_SHOWN pair on every re-open. The modal fires every
                    referral capture; this page fires none. */}
                {showInviteFriendsModal && user?.user.username && (
                    <InviteFriendsModal
                        visible
                        onClose={() => setShowInviteFriendsModal(false)}
                        username={user.user.username}
                        source={REFERRAL_SOURCES.QR_PAY_SUCCESS}
                    />
                )}
            </div>
        )
    }

    return (
        <>
            <SumsubKycWrapper
                visible={qrLimitIncreaseFlow.showWrapper}
                accessToken={qrLimitIncreaseFlow.accessToken}
                onClose={qrLimitIncreaseFlow.handleClose}
                onComplete={qrLimitIncreaseFlow.handleSdkComplete}
                onRefreshToken={qrLimitIncreaseFlow.refreshToken}
                isMultiLevel
            />
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title={tNav('pay')} />

                {/* Payment Content */}
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    {/* Merchant Card */}
                    <Card className="p-4">
                        <div className="space-x-3 flex items-center">
                            <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-white">
                                <Image
                                    src={methodIcon}
                                    alt={t('paymentMethodAlt')}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1 text-center text-body-s">
                                    <Icon name="arrow-up-right" size={10} /> {t('youArePaying')}
                                </p>
                                <p className="text-heading-xs break-words">{merchantName}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Amount Card */}
                    {currency && (
                        <AmountInput
                            initialAmount={currencyAmount}
                            setPrimaryAmount={setCurrencyAmount}
                            primaryDenomination={{
                                symbol: currency.symbol,
                                price: currency.price,
                                decimals: 2,
                            }}
                            secondaryDenomination={{
                                symbol: 'USD',
                                price: 1,
                                decimals: 2,
                            }}
                            setSecondaryAmount={setAmount}
                            disabled={
                                !!qrPayment || isLoading || (paymentProcessor === 'MANTECA' && paymentLock?.code !== '')
                            }
                            walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                            hideBalance
                        />
                    )}
                    {/* only show balance error if limits blocking card is not displayed (warnings can coexist) */}
                    {balanceErrorMessage && !limitsValidation.isBlocking && (
                        <Notification priority="error" data-testid="error-alert">
                            {balanceErrorMessage}
                        </Notification>
                    )}

                    {/* Limits Warning/Error Card */}
                    {(() => {
                        const limitsCardProps = getLimitsWarningCardProps({
                            validation: limitsValidation,
                            flowType: 'qr-payment',
                            currency: limitsValidation.currency,
                        })
                        if (!limitsCardProps) return null
                        return (
                            <LimitsWarningCard
                                {...limitsCardProps}
                                onIncreaseLimits={
                                    isBrQrEligible && limitsValidation.isBlocking
                                        ? qrLimitIncreaseFlow.handleInitiate
                                        : undefined
                                }
                                isIncreaseLimitsLoading={qrLimitIncreaseFlow.isLoading}
                            />
                        )
                    })()}

                    {/* Information Card */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow
                            label={t('info.exchangeRate')}
                            value={`1 USD = ${currency.price} ${currency.code.toUpperCase()}`}
                            moreInfoText={t('info.exchangeRateTooltip')}
                        />
                        {(() => {
                            if (!hasCardMarkupComparison(currency.code)) return null
                            const savingsInCents = calculateSavingsInCents(usdAmount, cardMarkup?.rate)
                            if (savingsInCents <= 0) return null
                            const savingsUsd = (savingsInCents / 100).toFixed(2)
                            return (
                                <PaymentInfoRow
                                    label={t('info.saveVsCard')}
                                    value={`~$${savingsUsd}`}
                                    moreInfoText={
                                        currency.code.toUpperCase() === 'BRL'
                                            ? t('info.saveVsCardTooltipBrl')
                                            : t('info.saveVsCardTooltipArs')
                                    }
                                />
                            )
                        })()}
                        <PaymentInfoRow
                            label={tCommon('peanutFee')}
                            value={tCommon('sponsoredByPeanut')}
                            hideBottomBorder
                        />
                    </Card>

                    {/* Send Button */}
                    <Button
                        onClick={payQR}
                        shadowSize="4"
                        loading={isLoading}
                        disabled={
                            !!errorInitiatingPayment ||
                            isBlockingError ||
                            !amount ||
                            isLoading ||
                            !!balanceErrorMessage ||
                            shouldBlockPay ||
                            !usdAmount ||
                            usdAmount === '0.00' ||
                            limitsValidation.isBlocking
                        }
                    >
                        {isLoading ? tCommon('loading') : tNav('pay')}
                    </Button>

                    {/* Error State */}
                    {errorMessage && (
                        <Notification priority="error" data-testid="error-alert">
                            {errorMessage}
                        </Notification>
                    )}
                </div>
            </div>
        </>
    )
}

const QrPayPageLoading = ({ message }: { message: string }) => {
    const t = useAppTranslations('qrPay')
    return (
        <div className="my-auto space-y-4 flex h-full w-full flex-col items-center justify-center">
            <div className="relative">
                <Image
                    src={PeanutThinking}
                    unoptimized
                    alt={t('peanutManAlt')}
                    layout="fill"
                    objectFit="contain"
                    className="absolute z-0 h-32 w-32 -translate-y-20"
                />

                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="clock" size={24} />
                    </div>
                    <p className="font-medium">{message}</p>
                </Card>
            </div>
        </div>
    )
}
