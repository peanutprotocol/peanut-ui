'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect, useContext, useRef } from 'react'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/KycVerificationInProgressModal'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { mantecaApi } from '@/services/manteca'
import type { QrPayment, QrPaymentLock } from '@/services/manteca'
import { simplefiApi } from '@/services/simplefi'
import type { SimpleFiQrPaymentResponse } from '@/services/simplefi'
import NavHeader from '@/components/Global/NavHeader'
import { MERCADO_PAGO, PIX, SIMPLEFI } from '@/assets/payment-apps'
import Image from 'next/image'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignUserOp } from '@/hooks/wallet/useSignUserOp'
import { clearRedirectUrl, getRedirectUrl, isTxReverted, saveRedirectUrl, formatNumberForDisplay } from '@/utils'
import { getShakeClass, type ShakeIntensity } from '@/utils/perk.utils'
import { calculateSavingsInCents, isArgentinaMantecaQrPayment, getSavingsMessage } from '@/utils/qr-payment.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { PEANUT_WALLET_TOKEN_DECIMALS, TRANSACTIONS, PERK_HOLD_DURATION_MS } from '@/constants'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants/manteca.consts'
import { MIN_MANTECA_QR_PAYMENT_AMOUNT } from '@/constants/payment.consts'
import { formatUnits, parseUnits } from 'viem'
import type { TransactionReceipt, Hash } from 'viem'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { loadingStateContext } from '@/context'
import { getCurrencyPrice } from '@/app/actions/currency'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { captureException } from '@sentry/nextjs'
import {
    isPaymentProcessorQR,
    parseSimpleFiQr,
    EQrType,
    NAME_BY_QR_TYPE,
    type QrType,
} from '@/components/Global/DirectSendQR/utils'
import type { SimpleFiQrData } from '@/components/Global/DirectSendQR/utils'
import { QrKycState, useQrKycGate } from '@/hooks/useQrKycGate'
import ActionModal from '@/components/Global/ActionModal'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { PeanutGuyGIF, STAR_STRAIGHT_ICON } from '@/assets'
import { useAuth } from '@/context/authContext'
import { PointsAction } from '@/services/services.types'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
import { completeHistoryEntry } from '@/utils/history.utils'
import { useSupportModalContext } from '@/context/SupportModalContext'
import maintenanceConfig from '@/config/underMaintenance.config'
import PointsCard from '@/components/Common/PointsCard'

const MAX_QR_PAYMENT_AMOUNT = '2000'
const MIN_QR_PAYMENT_AMOUNT = '0.1'

type PaymentProcessor = 'MANTECA' | 'SIMPLEFI'

export default function QRPayPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const qrCode = decodeURIComponent(searchParams.get('qrCode') || '')
    const timestamp = searchParams.get('t')
    const qrType = searchParams.get('type')
    const { balance, sendMoney } = useWallet()
    const { signTransferUserOp } = useSignUserOp()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const [errorInitiatingPayment, setErrorInitiatingPayment] = useState<string | null>(null)
    const [paymentLock, setPaymentLock] = useState<QrPaymentLock | null>(null)
    const [simpleFiPayment, setSimpleFiPayment] = useState<SimpleFiQrPaymentResponse | null>(null)
    const [simpleFiQrData, setSimpleFiQrData] = useState<SimpleFiQrData | null>(null)
    const [showOrderNotReadyModal, setShowOrderNotReadyModal] = useState(false)
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
    const [currency, setCurrency] = useState<{ code: string; symbol: string; price: number } | undefined>(undefined)
    const { openTransactionDetails, selectedTransaction, isDrawerOpen, closeTransactionDetails } =
        useTransactionDetailsDrawer()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)

    const paymentProcessor: PaymentProcessor | null = useMemo(() => {
        switch (qrType) {
            case EQrType.SIMPLEFI_STATIC:
            case EQrType.SIMPLEFI_DYNAMIC:
            case EQrType.SIMPLEFI_USER_SPECIFIED:
                return 'SIMPLEFI'
            case EQrType.MERCADO_PAGO:
            case EQrType.ARGENTINA_QR3:
            case EQrType.PIX:
                return 'MANTECA'
            default:
                return null
        }
    }, [qrType])

    // Check if this payment provider is under maintenance
    const isProviderDisabled = useMemo(() => {
        return paymentProcessor ? maintenanceConfig.disabledPaymentProviders.includes(paymentProcessor) : false
    }, [paymentProcessor])

    const { shouldBlockPay, kycGateState } = useQrKycGate(paymentProcessor)
    const queryClient = useQueryClient()
    const { hasPendingTransactions } = usePendingTransactions()
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const [isClaimingPerk, setIsClaimingPerk] = useState(false)
    const [perkClaimed, setPerkClaimed] = useState(false)
    const [holdProgress, setHoldProgress] = useState(0)
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const holdStartTimeRef = useRef<number | null>(null)
    const payingStateTimerRef = useRef<NodeJS.Timeout | null>(null)
    const { user } = useAuth()
    const [pendingSimpleFiPaymentId, setPendingSimpleFiPaymentId] = useState<string | null>(null)
    const [isWaitingForWebSocket, setIsWaitingForWebSocket] = useState(false)
    const [shouldRetry, setShouldRetry] = useState(true)
    const { setIsSupportModalOpen } = useSupportModalContext()
    const [waitingForMerchantAmount, setWaitingForMerchantAmount] = useState(false)
    const retryCount = useRef(0)

    const resetState = () => {
        setIsSuccess(false)
        setErrorMessage(null)
        setBalanceErrorMessage(null)
        setErrorInitiatingPayment(null)
        setPaymentLock(null)
        setSimpleFiPayment(null)
        setSimpleFiQrData(null)
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
        // reset retry and websocket states to allow refetching
        setShouldRetry(true)
        setIsWaitingForWebSocket(false)
        setPendingSimpleFiPaymentId(null)
        setWaitingForMerchantAmount(false)
        retryCount.current = 0
        // reset perk states
        setIsClaimingPerk(false)
        setPerkClaimed(false)
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

    const handleSimpleFiStatusUpdate = useCallback(
        async (entry: HistoryEntry) => {
            if (!pendingSimpleFiPaymentId || entry.uuid !== pendingSimpleFiPaymentId) {
                return
            }

            if (entry.type !== EHistoryEntryType.SIMPLEFI_QR_PAYMENT) {
                return
            }

            console.log('[SimpleFi WebSocket] Received status update:', entry.status)

            // Process entry through completeHistoryEntry to format amounts correctly
            let completedEntry
            try {
                completedEntry = await completeHistoryEntry(entry)
            } catch (error) {
                console.error('[SimpleFi WebSocket] Failed to process entry:', error)
                captureException(error, {
                    tags: { feature: 'simplefi-websocket' },
                    extra: { entryUuid: entry.uuid },
                })
                setIsWaitingForWebSocket(false)
                setPendingSimpleFiPaymentId(null)
                setErrorMessage('We received an update, but failed to process it. Please check your history.')
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }

            setIsWaitingForWebSocket(false)
            setPendingSimpleFiPaymentId(null)

            switch (completedEntry.status) {
                case 'approved': {
                    // Guard against missing currency or simpleFiPayment data
                    if (!completedEntry.currency?.code || !completedEntry.currency?.amount) {
                        console.error('[SimpleFi WebSocket] Currency data missing on approval')
                        captureException(new Error('SimpleFi payment approved but currency details missing'), {
                            extra: { entryUuid: completedEntry.uuid },
                        })
                        setErrorMessage('Payment approved, but details are incomplete. Please check your history.')
                        setIsSuccess(false)
                        setLoadingState('Idle')
                        break
                    }

                    if (!simpleFiPayment) {
                        console.error('[SimpleFi WebSocket] SimpleFi payment details missing on approval')
                        captureException(new Error('SimpleFi payment details missing on approval'), {
                            extra: { entryUuid: completedEntry.uuid },
                        })
                        setErrorMessage('Payment approved, but details are missing. Please check your history.')
                        setIsSuccess(false)
                        setLoadingState('Idle')
                        break
                    }

                    setSimpleFiPayment({
                        id: completedEntry.uuid,
                        usdAmount: completedEntry.extraData?.usdAmount || completedEntry.amount,
                        currency: completedEntry.currency.code,
                        currencyAmount: completedEntry.currency.amount,
                        price: simpleFiPayment.price,
                        address: simpleFiPayment.address,
                    })
                    setIsSuccess(true)
                    setLoadingState('Idle')
                    break
                }

                case 'expired':
                case 'canceled':
                case 'refunded':
                    setErrorMessage('Payment failed or expired. Please try again.')
                    setIsSuccess(false)
                    setLoadingState('Idle')
                    break

                default:
                    console.log('[SimpleFi WebSocket] Unknown status:', completedEntry.status)
            }
        },
        [pendingSimpleFiPaymentId, simpleFiPayment, setLoadingState]
    )

    useEffect(() => {
        if (isSuccess || !!errorMessage) {
            setLoadingState('Idle')
        }
    }, [isSuccess, errorMessage])

    // First fetch for qrcode info — only after KYC gating allows proceeding
    useEffect(() => {
        resetState()

        if (!qrCode || !isPaymentProcessorQR(qrCode)) {
            setErrorInitiatingPayment('Invalid QR code scanned')
            return
        }

        if (paymentProcessor === 'SIMPLEFI') {
            const parsed = parseSimpleFiQr(qrCode)
            setSimpleFiQrData(parsed)
        }

        setIsFirstLoad(false)
    }, [timestamp, paymentProcessor, qrCode])

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: true,
        onHistoryEntry: handleSimpleFiStatusUpdate,
    })

    useEffect(() => {
        if (!isWaitingForWebSocket || !pendingSimpleFiPaymentId) return

        const timeout = setTimeout(
            () => {
                console.log('[SimpleFi WebSocket] Timeout after 5 minutes')
                setIsWaitingForWebSocket(false)
                setPendingSimpleFiPaymentId(null)
                setErrorMessage('Payment is taking longer than expected. Please check your transaction history.')
                setLoadingState('Idle')
            },
            5 * 60 * 1000
        )

        return () => clearTimeout(timeout)
    }, [isWaitingForWebSocket, pendingSimpleFiPaymentId, setLoadingState])

    // Get amount from payment lock (Manteca)
    useEffect(() => {
        if (paymentProcessor !== 'MANTECA') return
        if (!paymentLock) return
        if (paymentLock.code !== '') {
            // For dynamic QR codes with preset amounts:
            // paymentAssetAmount is in local currency (e.g., "92" BRL)
            // paymentAgainstAmount is the USD equivalent (e.g., "18.4" USD)
            // TokenAmountInput expects tokenValue in USD, so we pass paymentAgainstAmount
            // It will convert to local currency for display using isInitialInputUsd=false
            setAmount(paymentLock.paymentAgainstAmount)
            setCurrencyAmount(paymentLock.paymentAssetAmount)
            setWaitingForMerchantAmount(false)
            setErrorInitiatingPayment(null)
            setShouldRetry(false)
        }
    }, [paymentLock?.code, paymentProcessor])

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
    }, [paymentLock?.code, paymentProcessor])

    // Set default currency for SimpleFi USER_SPECIFIED (user will enter amount)
    useEffect(() => {
        if (paymentProcessor !== 'SIMPLEFI') return
        if (simpleFiQrData?.type !== 'SIMPLEFI_USER_SPECIFIED') return
        if (currency) return // Already set

        // Default to ARS for SimpleFi payments
        getCurrencyPrice('ARS').then((priceData) => {
            setCurrency({
                code: 'ARS',
                symbol: 'ARS',
                price: priceData.sell,
            })
        })
    }, [paymentProcessor, simpleFiQrData?.type, currency])

    const isBlockingError = useMemo(() => {
        return !!errorMessage && errorMessage !== 'Please confirm the transaction.'
    }, [errorMessage])

    const usdAmount = useMemo(() => {
        if (paymentProcessor === 'SIMPLEFI') {
            return simpleFiPayment?.usdAmount || amount
        }
        if (!paymentLock) return null
        if (paymentLock.code === '') {
            // For static QR codes (user inputs amount), convert from local currency to USD
            // currencyAmount is in local currency (ARS, BRL), amount is the USD equivalent
            return amount
        } else {
            // For dynamic QR codes, backend provides the USD amount
            return paymentLock.paymentAgainstAmount
        }
    }, [paymentProcessor, simpleFiPayment, paymentLock?.code, paymentLock?.paymentAgainstAmount, amount])

    // Fetch points early to avoid latency penalty - fetch as soon as we have usdAmount
    // This way points are cached by the time success view shows
    // Only Manteca QR payments give points (SimpleFi does not)
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
                return 'https://flagcdn.com/w160/ar.png'
            case EQrType.PIX:
                return PIX
            case EQrType.SIMPLEFI_STATIC:
            case EQrType.SIMPLEFI_DYNAMIC:
            case EQrType.SIMPLEFI_USER_SPECIFIED:
                return SIMPLEFI
            default:
                return null
        }
    }, [qrType])

    // Fetch SimpleFi payment details
    useEffect(() => {
        if (paymentProcessor !== 'SIMPLEFI' || !simpleFiQrData) return
        if (!!simpleFiPayment) return
        if (kycGateState !== QrKycState.PROCEED_TO_PAY) return

        const fetchSimpleFiPayment = async () => {
            setLoadingState('Fetching details')
            try {
                let response: SimpleFiQrPaymentResponse

                if (simpleFiQrData.type === 'SIMPLEFI_STATIC') {
                    response = await simplefiApi.initiateQrPayment({
                        type: 'STATIC',
                        merchantSlug: simpleFiQrData.merchantSlug,
                    })
                } else if (simpleFiQrData.type === 'SIMPLEFI_DYNAMIC') {
                    response = await simplefiApi.initiateQrPayment({
                        type: 'DYNAMIC',
                        simplefiRequestId: simpleFiQrData.paymentId,
                    })
                } else {
                    setLoadingState('Idle')
                    return
                }

                setSimpleFiPayment(response)
                setAmount(response.usdAmount)
                setCurrencyAmount(response.currencyAmount)
                setCurrency({
                    code: 'ARS',
                    symbol: 'ARS',
                    price: Number(response.price),
                })
            } catch (error) {
                const errorMsg = (error as Error).message
                if (errorMsg.includes('ready to pay')) {
                    setShowOrderNotReadyModal(true)
                } else {
                    setErrorInitiatingPayment(errorMsg)
                }
            } finally {
                setLoadingState('Idle')
            }
        }

        fetchSimpleFiPayment()
    }, [kycGateState, simpleFiPayment, simpleFiQrData, paymentProcessor, setLoadingState])

    // Fetch Manteca payment lock immediately on QR scan (Manteca only)
    // OPTIMIZATION: We fetch payment details BEFORE KYC check completes for faster UX
    // This is SAFE because:
    // 1. We only fetch payment metadata (merchant info, amount) - no sensitive action
    // 2. The actual payment action is blocked by shouldBlockPay (line 713 & 1109)
    // 3. KYC modals are shown if needed before user can pay
    // This reduces latency from 4-5s to <1s for KYC'd users
    //
    // NETWORK RESILIENCE: Retry network/timeout errors with exponential backoff
    // - Max 3 attempts: immediate, +1s delay, +2s delay
    // - Provider-specific errors (e.g., "can't decode") are NOT retried
    // - Prevents state updates on unmounted component
    // Fetch Manteca payment lock with TanStack Query - handles retries, caching, and loading states
    const {
        data: fetchedPaymentLock,
        isLoading: isLoadingPaymentLock,
        error: paymentLockError,
        failureCount,
        failureReason: paymentLockFailureReason,
    } = useQuery({
        queryKey: ['manteca-payment-lock', qrCode, timestamp],
        queryFn: async ({ queryKey }) => {
            if (paymentProcessor !== 'MANTECA' || !qrCode || !isPaymentProcessorQR(qrCode)) {
                return null
            }
            return mantecaApi.initiateQrPayment({ qrCode })
        },
        enabled: paymentProcessor === 'MANTECA' && !!qrCode && isPaymentProcessorQR(qrCode) && !paymentLock,
        retry: (failureCount, error: any) => {
            // Don't retry provider-specific errors
            if (error?.message?.includes('PAYMENT_DESTINATION_DECODING_ERROR')) {
                return false
            }
            // Retry network/timeout errors up to 2 times (3 total attempts)
            return failureCount < 3
        },
        retryDelay: (attemptIndex) => {
            const delayMs = 3000 // 3s
            const MAX_RETRIES = 2
            const attemptNumber = attemptIndex + 1 // attemptIndex is 0-based, display as 1-based
            console.log(
                `Payment lock fetch failed, retrying in ${delayMs}ms... (attempt ${attemptNumber}/${MAX_RETRIES})`
            )
            return delayMs
        },
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
        }

        if (paymentLockError || paymentLockFailureReason) {
            const error = paymentLockError ?? paymentLockFailureReason
            setLoadingState('Idle')

            // Provider-specific errors: show appropriate message
            if (error.message.includes('PAYMENT_DESTINATION_MISSING_AMOUNT')) {
                setWaitingForMerchantAmount(true)
            } else if (error.message.includes('PAYMENT_DESTINATION_DECODING_ERROR')) {
                setErrorInitiatingPayment(
                    'We could not decode this particular QR code. Please ask the Merchant if they can generate a Mercado Pago QR'
                )
                setWaitingForMerchantAmount(false)
            } else {
                // Network/timeout errors after all retries exhausted
                setErrorInitiatingPayment(
                    `We are currently experiencing issues with ${qrType ? NAME_BY_QR_TYPE[qrType as QrType] : 'QR'} payments. We are working to fix it as soon as possible`
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
    ])

    const merchantName = useMemo(() => {
        if (paymentProcessor === 'SIMPLEFI') {
            if (simpleFiQrData?.type === 'SIMPLEFI_STATIC' || simpleFiQrData?.type === 'SIMPLEFI_USER_SPECIFIED') {
                return simpleFiQrData.merchantSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            }
            return 'SimpleFi Merchant'
        }
        if (!paymentLock) return null
        return paymentLock.paymentRecipientName
    }, [paymentProcessor, simpleFiQrData, paymentLock])

    const handleSimpleFiPayment = useCallback(async () => {
        if (!simpleFiPayment && !simpleFiQrData) return

        let finalPayment = simpleFiPayment

        if (simpleFiQrData?.type === 'SIMPLEFI_USER_SPECIFIED' && !simpleFiPayment && currencyAmount) {
            setLoadingState('Fetching details')
            try {
                finalPayment = await simplefiApi.initiateQrPayment({
                    type: 'USER_SPECIFIED',
                    merchantSlug: simpleFiQrData.merchantSlug,
                    currencyAmount: currencyAmount,
                    currency: 'ARS',
                })
                setSimpleFiPayment(finalPayment)
            } catch (error) {
                captureException(error)
                setErrorMessage('Unable to process payment. Please try again')
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
        }

        if (!finalPayment) {
            setErrorMessage('Unable to fetch payment details')
            setIsSuccess(false)
            setLoadingState('Idle')
            return
        }

        setLoadingState('Preparing transaction')
        let userOpHash: Hash
        let receipt: TransactionReceipt | null
        try {
            const result = await sendMoney(finalPayment.address, finalPayment.usdAmount)
            userOpHash = result.userOpHash
            receipt = result.receipt
        } catch (error) {
            if ((error as Error).toString().includes('not allowed')) {
                setErrorMessage('Please confirm the transaction in your wallet')
            } else {
                captureException(error)
                setErrorMessage('Could not complete the transaction')
                setIsSuccess(false)
            }
            setLoadingState('Idle')
            return
        }

        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage('Transaction was rejected by the network')
            setLoadingState('Idle')
            setIsSuccess(false)
            return
        }

        console.log('[SimpleFi] Transaction sent, waiting for WebSocket confirmation...')
        setLoadingState('Paying')
        setIsWaitingForWebSocket(true)
        setPendingSimpleFiPaymentId(finalPayment.id)
    }, [simpleFiPayment, simpleFiQrData, currencyAmount, sendMoney, setLoadingState])

    const handleMantecaPayment = useCallback(async () => {
        if (!paymentLock || !qrCode || !currencyAmount) return

        let finalPaymentLock = paymentLock
        if (finalPaymentLock.code === '') {
            setLoadingState('Fetching details')
            try {
                finalPaymentLock = await mantecaApi.initiateQrPayment({ qrCode, amount: currencyAmount })
                setPaymentLock(finalPaymentLock)
            } catch (error) {
                captureException(error)
                setErrorMessage('Could not initiate payment due to unexpected error. Please contact support')
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
        }
        if (finalPaymentLock.code === '') {
            setErrorMessage('Could not fetch qr payment details')
            setIsSuccess(false)
            setLoadingState('Idle')
            return
        }

        setLoadingState('Preparing transaction')
        let signedUserOpData
        try {
            signedUserOpData = await signTransferUserOp(MANTECA_DEPOSIT_ADDRESS, finalPaymentLock.paymentAgainstAmount)
        } catch (error) {
            if ((error as Error).toString().includes('not allowed')) {
                setErrorMessage('Please confirm the transaction.')
            } else {
                captureException(error)
                setErrorMessage('Could not sign the transaction.')
                setIsSuccess(false)
            }
            setLoadingState('Idle')
            return
        }

        // Send signed UserOp to backend for coordinated execution
        // Backend will: 1) Complete Manteca payment, 2) Broadcast UserOp only if Manteca succeeds
        // schedule "paying" state after 3 seconds to give user feedback that payment is processing
        payingStateTimerRef.current = setTimeout(() => setLoadingState('Paying'), 3000)
        try {
            const signedUserOp = {
                sender: signedUserOpData.signedUserOp.sender,
                nonce: signedUserOpData.signedUserOp.nonce,
                callData: signedUserOpData.signedUserOp.callData,
                signature: signedUserOpData.signedUserOp.signature,
                callGasLimit: signedUserOpData.signedUserOp.callGasLimit,
                verificationGasLimit: signedUserOpData.signedUserOp.verificationGasLimit,
                preVerificationGas: signedUserOpData.signedUserOp.preVerificationGas,
                factory: signedUserOpData.signedUserOp.factory,
                factoryData: signedUserOpData.signedUserOp.factoryData,
                maxFeePerGas: signedUserOpData.signedUserOp.maxFeePerGas,
                maxPriorityFeePerGas: signedUserOpData.signedUserOp.maxPriorityFeePerGas,
                paymaster: signedUserOpData.signedUserOp.paymaster,
                paymasterData: signedUserOpData.signedUserOp.paymasterData,
                paymasterVerificationGasLimit: signedUserOpData.signedUserOp.paymasterVerificationGasLimit,
                paymasterPostOpGasLimit: signedUserOpData.signedUserOp.paymasterPostOpGasLimit,
            }
            const qrPayment = await mantecaApi.completeQrPaymentWithSignedTx({
                paymentLockCode: finalPaymentLock.code,
                signedUserOp,
                chainId: signedUserOpData.chainId,
                entryPointAddress: signedUserOpData.entryPointAddress,
            })
            // clear the timer since we got a response
            if (payingStateTimerRef.current) {
                clearTimeout(payingStateTimerRef.current)
                payingStateTimerRef.current = null
            }
            setQrPayment(qrPayment)
            setIsSuccess(true)
        } catch (error) {
            // clear the timer on error to prevent race condition
            if (payingStateTimerRef.current) {
                clearTimeout(payingStateTimerRef.current)
                payingStateTimerRef.current = null
            }
            captureException(error)
            const errorMsg = (error as Error).message || 'Could not complete payment'

            // Handle specific error cases
            if (errorMsg.toLowerCase().includes('nonce')) {
                setErrorMessage(
                    'Transaction failed due to account state change. Please try again. If the problem persists, contact support.'
                )
            } else if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('stale')) {
                setErrorMessage('Payment session expired. Please scan the QR code again.')
            } else {
                setErrorMessage(
                    'Could not complete payment. Please scan the QR code again. If problem persists contact support'
                )
            }
            setIsSuccess(false)
        } finally {
            setLoadingState('Idle')
        }
    }, [paymentLock?.code, signTransferUserOp, qrCode, currencyAmount, setLoadingState])

    const payQR = useCallback(async () => {
        if (paymentProcessor === 'SIMPLEFI') {
            await handleSimpleFiPayment()
        } else if (paymentProcessor === 'MANTECA') {
            await handleMantecaPayment()
        }
    }, [paymentProcessor, handleSimpleFiPayment, handleMantecaPayment])

    // DEV NOTE: This is an OPTIMISTIC claim flow for better UX
    // We immediately show success UI and trigger confetti, then claim in background
    // If claim fails, we show error post-factum but keep the user in success state
    const claimPerk = useCallback(async () => {
        if (!qrPayment?.externalId) return

        // 1. IMMEDIATELY show success UI (optimistic)
        setPerkClaimed(true)

        // 2. Reset shake and show success with confetti RIGHT AWAY
        setIsShaking(false)
        setShakeIntensity('none')
        setHoldProgress(0)

        // 3. Final success haptic feedback - POWERFUL celebratory double pulse!
        if ('vibrate' in navigator) {
            navigator.vibrate([300, 100, 300])
        }

        // 4. Trigger confetti immediately
        setTimeout(() => {
            shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })
        }, 100)

        // 5. NOW do the actual API claim in the background
        setIsClaimingPerk(true)
        try {
            const result = await mantecaApi.claimPerk(qrPayment.externalId)
            if (result.success) {
                // Update qrPayment with actual claimed perk info from backend
                setQrPayment({
                    ...qrPayment,
                    perk: {
                        eligible: true,
                        discountPercentage: result.perk.discountPercentage,
                        claimed: true,
                        amountSponsored: result.perk.amountSponsored,
                        txHash: result.perk.txHash,
                    },
                })
            }
        } catch (error) {
            // If claim fails, show error but keep user in success state
            // (they already saw confetti, better UX than reverting)
            captureException(error)
            setErrorMessage('Perk claim is being processed. If you do not see it in your history, contact support.')
        } finally {
            setIsClaimingPerk(false)
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

                if ('vibrate' in navigator) {
                    navigator.vibrate(0)
                }
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

            if ('vibrate' in navigator) {
                navigator.vibrate(0)
            }
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
            if (newIntensity !== lastIntensity && 'vibrate' in navigator) {
                // Progressive vibration patterns that match shake intensity - MAX STRENGTH!
                switch (newIntensity) {
                    case 'weak':
                        navigator.vibrate(50) // Short but noticeable pulse
                        break
                    case 'medium':
                        navigator.vibrate([100, 40, 100]) // Medium pulse pattern
                        break
                    case 'strong':
                        navigator.vibrate([150, 40, 150, 40, 150]) // Strong pulse pattern
                        break
                    case 'intense':
                        navigator.vibrate([200, 40, 200, 40, 200, 40, 200]) // INTENSE pulse pattern
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
        // Skip balance check on success screen (balance may not have updated yet)
        if (isSuccess) {
            setBalanceErrorMessage(null)
            return
        }

        // Skip balance check if transaction is being processed
        // isLoading covers the gap between sendMoney completing and completeQrPayment finishing
        if (hasPendingTransactions || isWaitingForWebSocket || isLoading) {
            return
        }

        if (!usdAmount || usdAmount === '0.00' || isNaN(Number(usdAmount)) || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount.replace(/,/g, ''), PEANUT_WALLET_TOKEN_DECIMALS)

        // Manteca-specific validation (PIX, MercadoPago, QR3)
        if (paymentProcessor === 'MANTECA') {
            if (paymentAmount < parseUnits(MIN_MANTECA_QR_PAYMENT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
                setBalanceErrorMessage(`Payment amount must be at least $${MIN_MANTECA_QR_PAYMENT_AMOUNT}`)
                return
            }
        }

        // Common validations for all payment processors
        if (paymentAmount > parseUnits(MAX_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`QR payment amount exceeds maximum limit of $${MAX_QR_PAYMENT_AMOUNT}`)
        } else if (paymentAmount < parseUnits(MIN_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`QR payment amount must be at least $${MIN_QR_PAYMENT_AMOUNT}`)
        } else if (paymentAmount > balance) {
            setBalanceErrorMessage('Not enough balance to complete payment. Add funds!')
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance, hasPendingTransactions, isWaitingForWebSocket, isSuccess, isLoading, paymentProcessor])

    // Use points confetti hook for animation - must be called unconditionally
    usePointsConfetti(isSuccess && pointsData?.estimatedPoints ? pointsData.estimatedPoints : undefined, pointsDivRef)

    useEffect(() => {
        if (isSuccess) {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [isSuccess, queryClient])

    const handleSimplefiRetry = useCallback(async () => {
        setShowOrderNotReadyModal(false)
        if (!simpleFiQrData || simpleFiQrData.type !== 'SIMPLEFI_STATIC') return

        setLoadingState('Fetching details')
        try {
            const response = await simplefiApi.initiateQrPayment({
                type: 'STATIC',
                merchantSlug: simpleFiQrData.merchantSlug,
            })
            setSimpleFiPayment(response)
            setAmount(response.currencyAmount)
            setCurrencyAmount(response.currencyAmount)
            setCurrency({
                code: 'ARS',
                symbol: 'ARS',
                price: Number(response.price),
            })
        } catch (error) {
            const errorMsg = (error as Error).message
            if (errorMsg.includes('ready to pay')) {
                setShowOrderNotReadyModal(true)
            } else {
                setErrorInitiatingPayment(errorMsg)
            }
        } finally {
            setLoadingState('Idle')
        }
    }, [simpleFiQrData, setLoadingState])

    useEffect(() => {
        if (paymentProcessor !== 'SIMPLEFI') return
        if (!shouldRetry) return
        setShouldRetry(false)
        handleSimplefiRetry()
    }, [shouldRetry, handleSimplefiRetry])

    useEffect(() => {
        if (paymentProcessor === 'SIMPLEFI') {
            if (waitingForMerchantAmount && !shouldRetry) {
                if (retryCount.current < 3) {
                    retryCount.current++
                    setTimeout(() => {
                        setShouldRetry(true)
                    }, 3000)
                } else {
                    setWaitingForMerchantAmount(false)
                    setShowOrderNotReadyModal(true)
                }
            }
        } else if (paymentProcessor === 'MANTECA') {
            if (waitingForMerchantAmount && !isLoadingPaymentLock) {
                setWaitingForMerchantAmount(false)
                setShowOrderNotReadyModal(true)
            }
        }
    }, [waitingForMerchantAmount, shouldRetry, isLoadingPaymentLock, paymentProcessor])

    // Show maintenance error if provider is disabled
    if (isProviderDisabled) {
        // Get user-facing payment method name
        const paymentMethodName = useMemo(() => {
            if (paymentProcessor === 'MANTECA') {
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
            }
            return 'SimpleFi'
        }, [])

        return (
            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4">
                <Card className="flex w-full flex-col items-center gap-2 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-1 p-3">
                        <Icon name="alert" className="h-full" />
                    </div>
                    <span className="text-lg font-bold">Service Temporarily Unavailable</span>
                    <p className="text-center font-normal text-grey-1">
                        We're experiencing issues with {paymentMethodName} payments due to an external provider outage.
                        We're working to restore service as soon as possible.
                    </p>
                </Card>
                <Button onClick={() => router.back()} variant="purple" shadowSize="4">
                    Go Back
                </Button>
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-grey-1" />
                    Having trouble?
                </button>
            </div>
        )
    }

    if (!!errorInitiatingPayment) {
        return (
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-1 p-3">
                        <Icon name="alert" className="h-full" />
                    </div>
                    <p className="font-medium">
                        {' '}
                        {errorInitiatingPayment || 'An error occurred while getting the QR details.'}
                    </p>

                    <Button onClick={() => router.back()} variant="purple">
                        Go Back
                    </Button>
                </Card>
            </div>
        )
    }

    // check if we're still loading payment data or KYC state before showing anything
    // this prevents KYC modals from flashing on page refresh
    const isLoadingPaymentData =
        isFirstLoad ||
        (paymentProcessor === 'MANTECA' && !paymentLock) ||
        (paymentProcessor === 'SIMPLEFI' && simpleFiQrData?.type !== 'SIMPLEFI_USER_SPECIFIED' && !simpleFiPayment) ||
        !currency

    const isLoadingKycState = kycGateState === QrKycState.LOADING

    // only show KYC modals after both payment data and KYC state have loaded
    // explicitly check for KYC states that require blocking (not PROCEED_TO_PAY)
    const needsKycVerification =
        kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION ||
        kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS ||
        kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER

    if (needsKycVerification) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Pay" />
                <MantecaGeoSpecificKycModal
                    isUserBridgeKycApproved={kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER}
                    selectedCountry={{ id: 'AR', title: 'Argentina' }}
                    setIsMantecaModalOpen={() => {
                        router.back()
                    }}
                    isMantecaModalOpen={kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER}
                    onKycSuccess={() => {
                        saveRedirectUrl()
                        const redirectUrl = getRedirectUrl()
                        if (redirectUrl) {
                            clearRedirectUrl()
                            router.push(redirectUrl)
                        } else {
                            router.replace('/home')
                        }
                    }}
                />
                <ActionModal
                    visible={kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION}
                    onClose={() => router.back()}
                    title="Verify your identity to continue"
                    description="You'll need to verify your identity before paying with a QR code. Don't worry it usually just takes a few minutes."
                    icon={
                        methodIcon ? (
                            <Image src={methodIcon} alt="Payment method" width={48} height={48} priority />
                        ) : undefined
                    }
                    ctas={[
                        {
                            text: 'Verify now',
                            onClick: () => {
                                saveRedirectUrl()
                                router.push('/profile/identity-verification')
                            },
                            variant: 'purple',
                            shadowSize: '4',
                            icon: 'check-circle',
                        },
                    ]}
                    footer={<PeanutDoesntStoreAnyPersonalInformation />}
                />
                <ActionModal
                    visible={kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS}
                    onClose={() => router.back()}
                    title="Identity Verification"
                    description="Your identity is being verified. Please wait."
                    icon="shield"
                    ctas={[
                        {
                            text: 'Close',
                            onClick: () => {
                                router.back()
                            },
                            shadowSize: '4',
                            className: 'md:py-2',
                        },
                    ]}
                />
            </div>
        )
    }

    if (waitingForMerchantAmount) {
        return <QrPayPageLoading message="Waiting for the merchant to set the amount" />
    }

    if (showOrderNotReadyModal) {
        return (
            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4">
                <Card className="flex w-full flex-col items-center gap-2 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-1 p-3">
                        <Icon name="qr-code" className="h-full" />
                    </div>
                    <span className="text-lg font-bold">We couldn't get the amount</span>
                    <p className="max-w-52 text-center font-normal text-grey-1">
                        Ask the merchant to enter it and scan the QR again.
                    </p>
                </Card>
                <Button
                    onClick={() => {
                        setShowOrderNotReadyModal(false)
                        setShouldRetry(true)
                    }}
                    variant="purple"
                    shadowSize="4"
                >
                    Scan the code again
                </Button>
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-grey-1" />
                    Having trouble?
                </button>
            </div>
        )
    }

    // show loading spinner if we're still loading payment data OR KYC state
    if (isLoadingPaymentData || isLoadingKycState || loadingState.toLowerCase() === 'paying') {
        return (
            <PeanutLoading
                message={loadingState.toLowerCase() === 'paying' ? 'Almost there! Processing payment...' : undefined}
            />
        )
    }

    //Success
    if (isSuccess && paymentProcessor === 'MANTECA' && !qrPayment) {
        return null
    } else if (isSuccess && paymentProcessor === 'MANTECA') {
        // Calculate savings for Argentina Manteca QR payments only
        const savingsInCents = calculateSavingsInCents(usdAmount)
        const showSavingsMessage = savingsInCents > 0 && isArgentinaMantecaQrPayment(qrType, paymentProcessor)
        const savingsMessage = showSavingsMessage ? getSavingsMessage(savingsInCents) : ''

        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <SoundPlayer sound="success" />
                <NavHeader title="Pay" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    {/* Only show payment card if perk was not claimed */}
                    {!perkClaimed && !qrPayment?.perk?.claimed && (
                        <Card className="flex flex-row items-center gap-3 p-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={
                                        'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold'
                                    }
                                >
                                    <Icon name="check" size={24} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h1 className="text-sm font-normal text-grey-1">
                                    You paid {qrPayment?.details.merchant.name ?? paymentLock?.paymentRecipientName}
                                </h1>
                                <div className="text-2xl font-extrabold">
                                    {currency.symbol}{' '}
                                    {formatNumberForDisplay(
                                        qrPayment?.details.paymentAssetAmount ?? paymentLock?.paymentAssetAmount,
                                        { maxDecimals: 2 }
                                    )}
                                </div>
                                <div className="text-lg font-bold">
                                    ≈ {formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })} USD
                                </div>
                                {/* Savings Message (Argentina Manteca only) */}
                                {showSavingsMessage && savingsMessage && (
                                    <p className="text-sm italic text-grey-1">{savingsMessage}</p>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Perk Eligibility Card - Show before claiming */}
                    {qrPayment?.perk?.eligible && !perkClaimed && !qrPayment.perk.claimed && (
                        <Card ref={pointsDivRef} className="flex items-start gap-3 bg-white p-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400">
                                <Image src={STAR_STRAIGHT_ICON} alt="star" width={24} height={24} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-lg font-bold">Eligible for a Peanut Perk!</h2>
                                <p className="text-sm text-gray-600">
                                    {(() => {
                                        const percentage = qrPayment?.perk?.discountPercentage || 100
                                        const amountSponsored = qrPayment?.perk?.amountSponsored
                                        const transactionUsd =
                                            parseFloat(qrPayment?.details?.paymentAgainstAmount || '0') || 0

                                        // Check if percentage matches the actual math (within 1% tolerance)
                                        let percentageMatches = false
                                        if (amountSponsored && transactionUsd > 0) {
                                            const actualPercentage = (amountSponsored / transactionUsd) * 100
                                            percentageMatches = Math.abs(actualPercentage - percentage) < 1
                                        }

                                        if (percentageMatches) {
                                            if (percentage === 100) {
                                                return 'This bill can be covered by Peanut. Claim it now to unlock your reward.'
                                            } else if (percentage > 100) {
                                                return `You're getting ${percentage}% back — that's more than you paid! Claim it now.`
                                            } else {
                                                return `You're getting ${percentage}% cashback! Claim it now to unlock your reward.`
                                            }
                                        }

                                        return amountSponsored && typeof amountSponsored === 'number'
                                            ? `Get $${amountSponsored.toFixed(2)} back!`
                                            : 'Claim it now to unlock your reward.'
                                    })()}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Perk Success Banner - Show after claiming */}
                    {(perkClaimed || qrPayment?.perk?.claimed) && (
                        <Card className="flex items-start gap-4 bg-white p-6">
                            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400">
                                <Image src={STAR_STRAIGHT_ICON} alt="star" width={36} height={36} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h2 className="text-2xl font-bold">Peanut got you!</h2>
                                <p className="text-base text-gray-900">
                                    {(() => {
                                        const percentage = qrPayment?.perk?.discountPercentage || 100
                                        if (percentage === 100) {
                                            return 'We paid for this bill! Earn points, climb tiers and unlock even better perks.'
                                        } else if (percentage > 100) {
                                            return `We gave you ${percentage}% back — that's more than you paid! Earn points, climb tiers and unlock even better perks.`
                                        } else {
                                            return `We gave you ${percentage}% cashback! Earn points, climb tiers and unlock even better perks.`
                                        }
                                    })()}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Points Display - ref used for confetti origin point */}
                    {!qrPayment?.perk?.eligible && pointsData?.estimatedPoints && (
                        <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                    )}

                    <div className="w-full space-y-5">
                        {/* Show Claim Perk button if eligible and not claimed yet */}
                        {qrPayment?.perk?.eligible && !perkClaimed && !qrPayment.perk.claimed ? (
                            <Button
                                onPointerDown={startHold}
                                onPointerUp={cancelHold}
                                onPointerLeave={cancelHold}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !isClaimingPerk) {
                                        e.preventDefault()
                                        startHold()
                                    }
                                }}
                                onKeyUp={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !isClaimingPerk) {
                                        e.preventDefault()
                                        cancelHold()
                                    }
                                }}
                                onContextMenu={(e) => {
                                    // Prevent context menu from appearing
                                    e.preventDefault()
                                }}
                                shadowSize="4"
                                disabled={isClaimingPerk}
                                loading={isClaimingPerk}
                                className="relative touch-manipulation select-none overflow-hidden"
                                style={{
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                            >
                                {/* Black progress fill from left to right */}
                                <div
                                    className="absolute inset-0 bg-black transition-all duration-100"
                                    style={{
                                        width: `${holdProgress}%`,
                                        left: 0,
                                    }}
                                />
                                <span className="relative z-10">Claim Peanut Perk Now!</span>
                            </Button>
                        ) : (
                            <>
                                <Button
                                    onClick={() => {
                                        router.push(
                                            `/request?amount=${formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })}&merchant=${qrPayment!.details.merchant.name}`
                                        )
                                    }}
                                    icon="split"
                                    shadowSize="4"
                                >
                                    Split this bill
                                </Button>
                                <Button
                                    variant="primary-soft"
                                    shadowSize="4"
                                    disabled={false}
                                    onClick={() => {
                                        const now = new Date()
                                        openTransactionDetails({
                                            id: qrPayment!.externalId,
                                            direction: 'qr_payment',
                                            userName: qrPayment!.details.merchant.name,
                                            fullName: qrPayment!.details.merchant.name,
                                            amount: Number(usdAmount),
                                            currency: {
                                                amount: qrPayment!.details.paymentAssetAmount,
                                                code: currency.code,
                                            },
                                            initials: 'QR',
                                            currencySymbol: currency.symbol,
                                            status: 'completed',
                                            date: now,
                                            createdAt: now,
                                            extraDataForDrawer: {
                                                originalType: EHistoryEntryType.MANTECA_QR_PAYMENT,
                                                originalUserRole: EHistoryUserRole.SENDER,
                                                avatarUrl: methodIcon,
                                                receipt: {
                                                    exchange_rate: currency.price.toString(),
                                                },
                                            },
                                            totalAmountCollected: Number(usdAmount),
                                        })
                                    }}
                                >
                                    See receipt
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                <TransactionDetailsDrawer
                    isOpen={isDrawerOpen}
                    onClose={closeTransactionDetails}
                    transaction={selectedTransaction}
                />
            </div>
        )
    } else if (isSuccess && paymentProcessor === 'SIMPLEFI') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <SoundPlayer sound="success" />
                <NavHeader title="Pay" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                                <Icon name="check" size={24} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">You paid {merchantName}</h1>
                            <div className="text-2xl font-extrabold">
                                ARS{' '}
                                {formatNumberForDisplay(simpleFiPayment?.currencyAmount ?? currencyAmount ?? '0', {
                                    maxDecimals: 2,
                                })}
                            </div>
                            <div className="text-lg font-bold">
                                ≈ {formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })} USD
                            </div>
                        </div>
                    </Card>

                    <div className="w-full space-y-5">
                        <Button
                            onClick={() => {
                                router.push(
                                    `/request?amount=${formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })}&merchant=${qrPayment!.details.merchant.name}`
                                )
                            }}
                            icon="split"
                            shadowSize="4"
                        >
                            Split this bill
                        </Button>

                        <Button
                            variant="primary-soft"
                            shadowSize="4"
                            disabled={false}
                            onClick={() => {
                                const now = new Date()
                                openTransactionDetails({
                                    id: simpleFiPayment!.id,
                                    direction: 'qr_payment',
                                    userName: merchantName!,
                                    fullName: merchantName!,
                                    amount: Number(usdAmount),
                                    currency: {
                                        amount: simpleFiPayment!.currencyAmount,
                                        code: currency.code,
                                    },
                                    initials: 'SF',
                                    currencySymbol: currency.symbol,
                                    status: 'completed',
                                    date: now,
                                    createdAt: now,
                                    extraDataForDrawer: {
                                        originalType: EHistoryEntryType.SIMPLEFI_QR_PAYMENT,
                                        originalUserRole: EHistoryUserRole.SENDER,
                                        avatarUrl: methodIcon,
                                        receipt: {
                                            exchange_rate: currency.price.toString(),
                                        },
                                    },
                                    totalAmountCollected: Number(usdAmount),
                                })
                            }}
                        >
                            See receipt
                        </Button>
                    </div>
                </div>
                <TransactionDetailsDrawer
                    isOpen={isDrawerOpen}
                    onClose={closeTransactionDetails}
                    transaction={selectedTransaction}
                />
            </div>
        )
    }

    return (
        <>
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title="Pay" />

                {/* Payment Content */}
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    {/* Merchant Card */}
                    <Card className="p-4">
                        <div className="flex items-center space-x-3">
                            <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-white">
                                <Image
                                    src={methodIcon}
                                    alt="Payment method"
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1 text-center text-sm text-gray-600">
                                    <Icon name="arrow-up-right" size={10} /> You're paying
                                </p>
                                <p className="break-words text-xl font-semibold">{merchantName}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Amount Card */}
                    {currency && (
                        <TokenAmountInput
                            tokenValue={amount}
                            setTokenValue={setAmount}
                            currency={currency}
                            disabled={
                                !!qrPayment ||
                                isLoading ||
                                (paymentProcessor === 'MANTECA' && paymentLock?.code !== '') ||
                                (paymentProcessor === 'SIMPLEFI' &&
                                    simpleFiQrData?.type !== 'SIMPLEFI_USER_SPECIFIED' &&
                                    !!simpleFiPayment)
                            }
                            walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                            setCurrencyAmount={setCurrencyAmount}
                            hideBalance
                            isInitialInputUsd={false}
                        />
                    )}
                    {balanceErrorMessage && <ErrorAlert description={balanceErrorMessage} />}

                    {/* Information Card */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow
                            label="Exchange Rate"
                            value={`1 USD = ${currency.price} ${currency.code.toUpperCase()}`}
                        />
                        <PaymentInfoRow label="Peanut fee" value="Sponsored by Peanut!" hideBottomBorder />
                    </Card>

                    {/* Send Button */}
                    <Button
                        onClick={payQR}
                        shadowSize="4"
                        loading={isLoading || isWaitingForWebSocket}
                        disabled={
                            !!errorInitiatingPayment ||
                            isBlockingError ||
                            !amount ||
                            isLoading ||
                            !!balanceErrorMessage ||
                            shouldBlockPay ||
                            !usdAmount ||
                            usdAmount === '0.00' ||
                            isWaitingForWebSocket
                        }
                    >
                        {isLoading || isWaitingForWebSocket
                            ? isWaitingForWebSocket
                                ? 'Processing Payment...'
                                : loadingState
                            : 'Pay'}
                    </Button>

                    {/* Error State */}
                    {errorMessage && <ErrorAlert description={errorMessage} />}
                </div>
            </div>
        </>
    )
}

export const QrPayPageLoading = ({ message }: { message: string }) => {
    return (
        <div className="my-auto flex h-full w-full flex-col items-center justify-center space-y-4">
            <div className="relative">
                <Image
                    src={PeanutGuyGIF}
                    alt="Peanut Man"
                    layout="fill"
                    objectFit="contain"
                    className="absolute z-0 h-32 w-32 -translate-y-20 "
                />

                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-1 p-3">
                        <Icon name="clock" className="h-full" />
                    </div>
                    <p className="font-medium">{message}</p>
                </Card>
            </div>
        </div>
    )
}
