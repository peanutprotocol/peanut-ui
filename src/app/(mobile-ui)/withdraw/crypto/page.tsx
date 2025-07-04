'use client'

import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import PeanutLoading from '@/components/Global/PeanutLoading'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import ConfirmWithdrawView from '@/components/Withdraw/views/Confirm.withdraw.view'
import InitialWithdrawView from '@/components/Withdraw/views/Initial.withdraw.view'
import { useWithdrawFlow, WithdrawData } from '@/context/WithdrawFlowContext'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import {
    CreateChargeRequest,
    CreateRequestRequest as CreateRequestPayloadServices,
    TCharge,
    TRequestChargeResponse,
    TRequestResponse,
} from '@/services/services.types'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const { chargeDetails: activeChargeDetailsFromStore } = usePaymentStore()
    const { isConnected: isPeanutWallet } = useWallet()
    const {
        amountToWithdraw,
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
    } = useWithdrawFlow()

    const {
        initiatePayment,
        isProcessing,
        error: paymentErrorFromHook,
        prepareTransactionDetails,
        xChainRoute,
        isCalculatingFees,
        isPreparingTx,
    } = usePaymentInitiator()

    // Helper to manage errors consistently
    const setError = useCallback(
        (error: string | null) => {
            setPaymentError(error)
            dispatch(paymentActions.setError(error))
        },
        [setPaymentError, dispatch]
    )

    const clearErrors = useCallback(() => {
        setError(null)
    }, [setError])

    useEffect(() => {
        if (!amountToWithdraw) {
            console.error('Amount not available in WithdrawFlowContext for withdrawal, redirecting.')
            router.push('/withdraw')
            return
        }
        clearErrors()
        dispatch(paymentActions.setChargeDetails(null))
    }, [amountToWithdraw])

    useEffect(() => {
        setPaymentError(paymentErrorFromHook)
    }, [paymentErrorFromHook])

    useEffect(() => {
        if (currentView === 'CONFIRM' && activeChargeDetailsFromStore && withdrawData) {
            console.log('Preparing withdraw transaction details...')
            console.dir(activeChargeDetailsFromStore)
            prepareTransactionDetails(
                activeChargeDetailsFromStore,
                PEANUT_WALLET_TOKEN,
                PEANUT_WALLET_CHAIN.id.toString(),
                amountToWithdraw
            )
        }
    }, [currentView, activeChargeDetailsFromStore, withdrawData, prepareTransactionDetails, amountToWithdraw])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set or not available from context')
                setError('Withdrawal amount is missing.')
                return
            }

            clearErrors()
            dispatch(paymentActions.setChargeDetails(null))

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

                const fullChargeDetails: TRequestChargeResponse = await chargesApi.get(createdCharge.data.id)

                dispatch(paymentActions.setChargeDetails(fullChargeDetails))
                setShowCompatibilityModal(true)
            } catch (err: any) {
                console.error('Error during setup review (request/charge creation):', err)
                const errorMessage = err.message || 'Could not prepare withdrawal. Please try again.'
                setError(errorMessage)
            } finally {
                setIsPreparingReview(false)
            }
        },
        [amountToWithdraw, dispatch, setCurrentView]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (activeChargeDetailsFromStore && withdrawData) {
            setCurrentView('CONFIRM')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setError('Failed to load withdrawal details for confirmation. Please go back and try again.')
        }
    }, [activeChargeDetailsFromStore, withdrawData, setCurrentView])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!activeChargeDetailsFromStore || !withdrawData || !amountToWithdraw) {
            console.error('Withdraw data, active charge details, or amount missing for final confirmation')
            setError('Essential withdrawal information is missing.')
            return
        }

        clearErrors()
        dispatch(paymentActions.setError(null))

        const paymentPayload: InitiatePaymentPayload = {
            recipient: {
                identifier: withdrawData.address,
                recipientType: 'ADDRESS',
                resolvedAddress: withdrawData.address,
            },
            tokenAmount: amountToWithdraw,
            chargeId: activeChargeDetailsFromStore.uuid,
            skipChargeCreation: true,
        }

        const result = await initiatePayment(paymentPayload)

        if (result.success && result.txHash) {
            setCurrentView('STATUS')
        } else {
            console.error('Withdrawal execution failed:', result.error)
            const errMsg = result.error || 'Withdrawal processing failed.'
            setError(errMsg)
        }
    }, [
        activeChargeDetailsFromStore,
        withdrawData,
        amountToWithdraw,
        dispatch,
        initiatePayment,
        setCurrentView,
        setAmountToWithdraw,
        setWithdrawData,
        setPaymentError,
    ])

    const handleRouteRefresh = useCallback(async () => {
        if (!activeChargeDetailsFromStore) return
        console.log('Refreshing withdraw route due to expiry...')
        console.log('About to call prepareTransactionDetails with:', activeChargeDetailsFromStore)
        await prepareTransactionDetails(
            activeChargeDetailsFromStore,
            PEANUT_WALLET_TOKEN,
            PEANUT_WALLET_CHAIN.id.toString(),
            amountToWithdraw
        )
    }, [activeChargeDetailsFromStore, prepareTransactionDetails, amountToWithdraw])

    const handleBackFromConfirm = useCallback(() => {
        setCurrentView('INITIAL')
        clearErrors()
        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setChargeDetails(null))
    }, [dispatch, setCurrentView])

    // Check if this is a cross-chain withdrawal (align with usePaymentInitiator logic)
    const isCrossChainWithdrawal = useMemo<boolean>(() => {
        if (!withdrawData || !activeChargeDetailsFromStore) return false

        // In withdraw flow, we're moving from Peanut Wallet to the selected chain
        // This matches the logic in usePaymentInitiator for withdraw flows
        const fromChainId = isPeanutWallet ? PEANUT_WALLET_CHAIN.id.toString() : withdrawData.chain.chainId
        const toChainId = activeChargeDetailsFromStore.chainId

        console.log('Cross-chain check:', {
            fromChainId,
            toChainId,
            isPeanutWallet,
            isCrossChain: fromChainId !== toChainId,
        })

        return fromChainId !== toChainId
    }, [withdrawData, activeChargeDetailsFromStore, isPeanutWallet])

    // Check for route type errors (similar to payment flow)
    const routeTypeError = useMemo<string | null>(() => {
        if (!isCrossChainWithdrawal || !xChainRoute || !isPeanutWallet) return null

        // For peanut wallet flows, only RFQ routes are allowed
        if (xChainRoute.type === 'swap') {
            return 'This token pair is not available for withdraw.'
        }

        return null
    }, [isCrossChainWithdrawal, xChainRoute, isPeanutWallet])

    // Display payment errors first (user actions), then route errors (system limitations)
    const displayError = paymentError ?? routeTypeError

    // Get network fee from route or fallback
    const networkFee = useCallback(() => {
        if (xChainRoute?.feeCostsUsd) {
            return xChainRoute.feeCostsUsd < 0.01 ? '$ <0.01' : `$ ${xChainRoute.feeCostsUsd.toFixed(2)}`
        }
        return '$ 0.00'
    }, [xChainRoute])

    if (!amountToWithdraw) {
        return <PeanutLoading />
    }

    return (
        <div className="mx-auto h-full min-h-[inherit] w-full max-w-md space-y-4 self-center">
            {currentView === 'INITIAL' && (
                <InitialWithdrawView
                    amount={amountToWithdraw}
                    onReview={handleSetupReview}
                    onBack={() => router.back()}
                    isProcessing={isPreparingReview}
                />
            )}

            {currentView === 'CONFIRM' && withdrawData && activeChargeDetailsFromStore && (
                <ConfirmWithdrawView
                    amount={amountToWithdraw}
                    token={withdrawData.token}
                    chain={withdrawData.chain}
                    toAddress={withdrawData.address}
                    onConfirm={handleConfirmWithdrawal}
                    onBack={handleBackFromConfirm}
                    isProcessing={isProcessing}
                    error={displayError}
                    networkFee={networkFee()}
                    // Timer props for cross-chain withdrawals
                    isCrossChain={isCrossChainWithdrawal}
                    routeExpiry={xChainRoute?.expiry}
                    isRouteLoading={isCalculatingFees || isPreparingTx}
                    onRouteRefresh={handleRouteRefresh}
                    xChainRoute={xChainRoute ?? undefined}
                />
            )}

            {currentView === 'STATUS' && withdrawData && activeChargeDetailsFromStore && (
                <>
                    <DirectSuccessView
                        headerTitle="Withdraw"
                        recipientType="ADDRESS"
                        type="SEND"
                        currencyAmount={`$ ${amountToWithdraw}`}
                        isWithdrawFlow={true}
                        redirectTo="/withdraw"
                        message={
                            <AddressLink
                                className="text-sm font-normal text-grey-1 no-underline"
                                address={withdrawData.address}
                            />
                        }
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
                ctas={[
                    {
                        text: 'Proceed',
                        onClick: handleCompatibilityProceed,
                        variant: 'purple',
                        shadowSize: '4',
                        className: 'h-10 text-sm',
                        icon: 'check-circle',
                    },
                ]}
            />
        </div>
    )
}
