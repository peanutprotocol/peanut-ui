'use client'

import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import PeanutLoading from '@/components/Global/PeanutLoading'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import ConfirmWithdrawView from '@/components/Withdraw/views/Confirm.withdraw.view'
import InitialWithdrawView from '@/components/Withdraw/views/Initial.withdraw.view'
import { useWithdrawFlow, type WithdrawData } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import type {
    CreateChargeRequest,
    CreateRequestRequest as CreateRequestPayloadServices,
    TCharge,
    TRequestResponse,
} from '@/services/services.types'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { captureMessage } from '@sentry/nextjs'
import type { Address } from 'viem'
import { Slider } from '@/components/Slider'
import { tokenSelectorContext } from '@/context'
import { useHaptic } from 'use-haptic'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants/general.consts'
import { useRouteCalculation } from '@/features/payments/shared/hooks/useRouteCalculation'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { isTxReverted } from '@/utils/general.utils'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const { isConnected: isPeanutWallet, address, sendTransactions } = useWallet()
    const { resetTokenContextProvider } = useContext(tokenSelectorContext)
    const {
        amountToWithdraw,
        usdAmount,
        setAmountToWithdraw,
        currentView,
        setCurrentView,
        withdrawData,
        setWithdrawData,
        showCompatibilityModal,
        setShowCompatibilityModal,
        isPreparingReview,
        setIsPreparingReview,
        paymentError,
        setPaymentError,
        setError: setWithdrawError,
        chargeDetails,
        setChargeDetails,
        setTransactionHash,
        paymentDetails,
        setPaymentDetails,
        resetWithdrawFlow,
    } = useWithdrawFlow()

    // hooks for route calculation and payment recording
    const {
        route: xChainRoute,
        transactions,
        isCalculating,
        error: routeError,
        calculateRoute,
        reset: resetRouteCalculation,
    } = useRouteCalculation()

    const { isRecording, error: recordError, recordPayment, reset: resetPaymentRecorder } = usePaymentRecorder()

    const { triggerHaptic } = useHaptic()

    // local state for transaction execution
    const [isSendingTx, setIsSendingTx] = useState(false)

    // combined processing state
    const isProcessing = useMemo(() => isSendingTx || isRecording, [isSendingTx, isRecording])

    // helper to manage errors consistently
    const setError = useCallback(
        (error: string | null) => {
            setPaymentError(error)
            // also set the withdraw flow error state for display in InitialWithdrawView
            setWithdrawError({
                showError: !!error,
                errorMessage: error || '',
            })
        },
        [setPaymentError, setWithdrawError]
    )

    const clearErrors = useCallback(() => {
        setError(null)
    }, [setError])

    // reset on mount
    useEffect(() => {
        setChargeDetails(null)
        setTransactionHash(null)
        setPaymentDetails(null)
        resetRouteCalculation()
        resetPaymentRecorder()
    }, [setChargeDetails, setTransactionHash, setPaymentDetails, resetRouteCalculation, resetPaymentRecorder])

    // clear errors when amount changes
    useEffect(() => {
        if (amountToWithdraw) {
            clearErrors()
            setChargeDetails(null)
        }
    }, [amountToWithdraw, clearErrors, setChargeDetails])

    // propagate route/record errors
    useEffect(() => {
        const error = routeError || recordError
        if (error) {
            setPaymentError(error)
        }
    }, [routeError, recordError, setPaymentError])

    // prepare transaction when entering confirm view
    useEffect(() => {
        if (currentView === 'CONFIRM' && chargeDetails && withdrawData && address) {
            console.log('Preparing withdraw transaction details...')
            console.dir(chargeDetails)
            calculateRoute({
                source: {
                    address: address as Address,
                    tokenAddress: PEANUT_WALLET_TOKEN,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                },
                destination: {
                    recipientAddress: chargeDetails.requestLink.recipientAddress as Address,
                    tokenAddress: chargeDetails.tokenAddress as Address,
                    tokenAmount: chargeDetails.tokenAmount,
                    tokenDecimals: chargeDetails.tokenDecimals,
                    tokenType: Number(chargeDetails.tokenType),
                    chainId: chargeDetails.chainId,
                },
                usdAmount: usdAmount,
                skipGasEstimate: true, // peanut wallet handles gas
            })
        }
    }, [currentView, chargeDetails, withdrawData, calculateRoute, usdAmount, address])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set or not available from context')
                setError('Withdrawal amount is missing.')
                return
            }

            clearErrors()
            setChargeDetails(null)
            setIsPreparingReview(true)

            try {
                const completeWithdrawData = { ...data, amount: amountToWithdraw }
                setWithdrawData(completeWithdrawData)
                const apiRequestPayload: CreateRequestPayloadServices = {
                    recipientAddress: completeWithdrawData.address,
                    chainId: completeWithdrawData.chain.chainId.toString(),
                    tokenAddress: completeWithdrawData.token.address,
                    tokenType: String(
                        completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                            ? peanutInterfaces.EPeanutLinkType.native
                            : peanutInterfaces.EPeanutLinkType.erc20
                    ),
                    tokenAmount: amountToWithdraw,
                    tokenDecimals: completeWithdrawData.token.decimals.toString(),
                    tokenSymbol: completeWithdrawData.token.symbol,
                }
                const newRequest: TRequestResponse = await requestsApi.create(apiRequestPayload)

                if (!newRequest || !newRequest.uuid) {
                    throw new Error('Failed to create request for withdrawal.')
                }

                const chargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: { amount: completeWithdrawData.amount || amountToWithdraw, currency: 'USD' },
                    baseUrl: window.location.origin,
                    requestId: newRequest.uuid,
                    requestProps: {
                        chainId: completeWithdrawData.chain.chainId.toString(),
                        tokenAmount: completeWithdrawData.amount,
                        tokenAddress: completeWithdrawData.token.address,
                        tokenType:
                            completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                                ? peanutInterfaces.EPeanutLinkType.native
                                : peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: completeWithdrawData.token.symbol,
                        tokenDecimals: Number(completeWithdrawData.token.decimals),
                        recipientAddress: completeWithdrawData.address,
                    },
                    transactionType: 'WITHDRAW',
                }
                const createdCharge: TCharge = await chargesApi.create(chargePayload)

                if (!createdCharge || !createdCharge.data || !createdCharge.data.id) {
                    throw new Error('Failed to create charge for withdrawal or charge ID missing.')
                }

                const fullChargeDetails = await chargesApi.get(createdCharge.data.id)

                setChargeDetails(fullChargeDetails)
                setShowCompatibilityModal(true)
            } catch (err: any) {
                console.error('Error during setup review (request/charge creation):', err)
                const errorMessage = err.message || 'Could not prepare withdrawal. Please try again.'
                setError(errorMessage)
            } finally {
                setIsPreparingReview(false)
            }
        },
        [
            amountToWithdraw,
            clearErrors,
            setChargeDetails,
            setIsPreparingReview,
            setWithdrawData,
            setShowCompatibilityModal,
            setError,
        ]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (chargeDetails && withdrawData) {
            setCurrentView('CONFIRM')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setError('Failed to load withdrawal details for confirmation. Please go back and try again.')
        }
    }, [chargeDetails, withdrawData, setCurrentView, setShowCompatibilityModal, setError])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!chargeDetails || !withdrawData || !amountToWithdraw || !address) {
            console.error('Withdraw data, active charge details, or amount missing for final confirmation')
            setError('Essential withdrawal information is missing.')
            return
        }

        if (!transactions || transactions.length === 0) {
            console.error('No transactions prepared for withdrawal')
            setError('Transaction not prepared. Please try again.')
            return
        }

        clearErrors()
        setIsSendingTx(true)

        try {
            // send transactions via peanut wallet
            const txResult = await sendTransactions(transactions, PEANUT_WALLET_CHAIN.id.toString())
            const receipt = txResult.receipt
            const userOpHash = txResult.userOpHash

            // validate transaction
            if (receipt !== null && isTxReverted(receipt)) {
                throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
            }

            const finalTxHash = receipt?.transactionHash ?? userOpHash

            // record payment to backend
            const payment = await recordPayment({
                chargeId: chargeDetails.uuid,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                txHash: finalTxHash,
                tokenAddress: PEANUT_WALLET_TOKEN,
                payerAddress: address as Address,
            })

            setTransactionHash(finalTxHash)
            setPaymentDetails(payment)
            triggerHaptic()
            setCurrentView('STATUS')
        } catch (err) {
            console.error('Withdrawal execution failed:', err)
            const errMsg = ErrorHandler(err)
            setError(errMsg)
        } finally {
            setIsSendingTx(false)
        }
    }, [
        chargeDetails,
        withdrawData,
        amountToWithdraw,
        address,
        transactions,
        sendTransactions,
        recordPayment,
        setCurrentView,
        setTransactionHash,
        setPaymentDetails,
        clearErrors,
        setError,
        triggerHaptic,
    ])

    const handleRouteRefresh = useCallback(async () => {
        if (!chargeDetails || !address) return
        console.log('Refreshing withdraw route due to expiry...')
        await calculateRoute({
            source: {
                address: address as Address,
                tokenAddress: PEANUT_WALLET_TOKEN,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
            },
            destination: {
                recipientAddress: chargeDetails.requestLink.recipientAddress as Address,
                tokenAddress: chargeDetails.tokenAddress as Address,
                tokenAmount: chargeDetails.tokenAmount,
                tokenDecimals: chargeDetails.tokenDecimals,
                tokenType: Number(chargeDetails.tokenType),
                chainId: chargeDetails.chainId,
            },
            usdAmount: usdAmount,
            skipGasEstimate: true,
        })
    }, [chargeDetails, calculateRoute, usdAmount, address])

    const handleBackFromConfirm = useCallback(() => {
        setCurrentView('INITIAL')
        clearErrors()
        setChargeDetails(null)
    }, [setCurrentView, clearErrors, setChargeDetails])

    // check if this is a cross-chain withdrawal
    const isCrossChainWithdrawal = useMemo<boolean>(() => {
        if (!withdrawData || !chargeDetails) return false

        // in withdraw flow, we're moving from Peanut Wallet to the selected chain
        const fromChainId = isPeanutWallet ? PEANUT_WALLET_CHAIN.id.toString() : withdrawData.chain.chainId
        const toChainId = chargeDetails.chainId

        return fromChainId !== toChainId
    }, [withdrawData, chargeDetails, isPeanutWallet])

    // reset withdraw flow when this component unmounts
    useEffect(() => {
        return () => {
            resetRouteCalculation()
            resetPaymentRecorder()
            resetTokenContextProvider() // reset token selector context to make sure previously selected token is not cached
        }
    }, [resetRouteCalculation, resetPaymentRecorder, resetTokenContextProvider])

    // Check for route type errors (similar to payment flow)
    const routeTypeError = useMemo<string | null>(() => {
        if (!isCrossChainWithdrawal || !xChainRoute || !isPeanutWallet) return null

        // For peanut wallet flows, only RFQ routes are allowed
        if (xChainRoute.type === 'swap') {
            captureMessage('No RFQ route found for this token pair', {
                level: 'warning',
                extra: {
                    flow: 'withdraw',
                    routeObject: xChainRoute,
                },
            })
            return ROUTE_NOT_FOUND_ERROR
        }

        return null
    }, [isCrossChainWithdrawal, xChainRoute, isPeanutWallet])

    // Display payment errors first (user actions), then route errors (system limitations)
    const displayError = paymentError ?? routeTypeError

    // Get network fee from route or fallback
    const networkFee = useMemo<number>(() => {
        if (xChainRoute?.feeCostsUsd) {
            return xChainRoute.feeCostsUsd
        }
        return 0
    }, [xChainRoute])

    if (!amountToWithdraw) {
        // Redirect to main withdraw page for amount input
        router.push('/withdraw')
        return <PeanutLoading />
    }

    return (
        <div className="mx-auto min-h-[inherit] w-full max-w-md space-y-4 self-center">
            {currentView === 'INITIAL' && (
                <InitialWithdrawView
                    amount={usdAmount}
                    onReview={handleSetupReview}
                    onBack={() => router.back()}
                    isProcessing={isPreparingReview}
                />
            )}

            {currentView === 'CONFIRM' && withdrawData && chargeDetails && (
                <ConfirmWithdrawView
                    amount={usdAmount}
                    token={withdrawData.token}
                    chain={withdrawData.chain}
                    toAddress={withdrawData.address}
                    onConfirm={handleConfirmWithdrawal}
                    onBack={handleBackFromConfirm}
                    isProcessing={isProcessing}
                    error={displayError}
                    networkFee={networkFee}
                    // timer props for cross-chain withdrawals
                    isCrossChain={isCrossChainWithdrawal}
                    routeExpiry={xChainRoute?.expiry}
                    isRouteLoading={isCalculating}
                    onRouteRefresh={handleRouteRefresh}
                    xChainRoute={xChainRoute ?? undefined}
                />
            )}

            {currentView === 'STATUS' && withdrawData && chargeDetails && (
                <>
                    <PaymentSuccessView
                        headerTitle="Withdraw"
                        recipientType="ADDRESS"
                        type="SEND"
                        amount={usdAmount}
                        isWithdrawFlow={true}
                        redirectTo="/home"
                        chargeDetails={chargeDetails}
                        paymentDetails={paymentDetails}
                        usdAmount={usdAmount}
                        message={
                            <AddressLink
                                className="text-sm font-normal text-grey-1 no-underline"
                                address={withdrawData.address}
                            />
                        }
                        onComplete={() => {
                            resetWithdrawFlow()
                        }}
                    />
                </>
            )}

            <ActionModal
                visible={showCompatibilityModal}
                onClose={() => {
                    if (isPreparingReview) return
                    setShowCompatibilityModal(false)
                }}
                preventClose={isPreparingReview}
                title="Is this address compatible?"
                description="Only send to address that support the selected network and token. Incorrect transfers may be lost."
                icon="alert"
                footer={
                    <div className="w-full">
                        <Slider
                            onValueChange={(v: boolean) => {
                                if (!v) return
                                handleCompatibilityProceed()
                            }}
                        />
                    </div>
                }
            />
        </div>
    )
}
