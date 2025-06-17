'use client'

import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import PeanutLoading from '@/components/Global/PeanutLoading'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import ConfirmWithdrawView from '@/components/Withdraw/views/Confirm.withdraw.view'
import InitialWithdrawView from '@/components/Withdraw/views/Initial.withdraw.view'
import { useWithdrawFlow, WithdrawData } from '@/context/WithdrawFlowContext'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
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
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

export default function WithdrawCryptoPage() {
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null)
    const router = useRouter()
    const dispatch = useAppDispatch()
    const { chargeDetails: activeChargeDetailsFromStore } = usePaymentStore()
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
        feeCalculations,
        prepareTransactionDetails,
    } = usePaymentInitiator()

    useEffect(() => {
        if (!amountToWithdraw) {
            console.error('Amount not available in WithdrawFlowContext for withdrawal, redirecting.')
            router.push('/withdraw')
            return
        }
        dispatch(paymentActions.setChargeDetails(null))
        setPaymentError(null)
        setCurrentView('INITIAL')
    }, [amountToWithdraw, router, dispatch, setAmountToWithdraw, setCurrentView])

    useEffect(() => {
        setPaymentError(paymentErrorFromHook)
    }, [paymentErrorFromHook])

    useEffect(() => {
        if (currentView === 'CONFIRM' && activeChargeDetailsFromStore && withdrawData) {
            prepareTransactionDetails(activeChargeDetailsFromStore, false)
        }
    }, [currentView, activeChargeDetailsFromStore, withdrawData, prepareTransactionDetails])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set or not available from context')
                setPaymentError('Withdrawal amount is missing.')
                return
            }
            const completeWithdrawData = { ...data, amount: amountToWithdraw }
            setWithdrawData(completeWithdrawData)

            setIsPreparingReview(true)
            setPaymentError(null)
            dispatch(paymentActions.setError(null))
            dispatch(paymentActions.setChargeDetails(null))

            try {
                const apiRequestPayload: CreateRequestPayloadServices = {
                    recipientAddress: completeWithdrawData.address,
                    chainId: completeWithdrawData.chain.chainId.toString(),
                    tokenAddress: completeWithdrawData.token.address,
                    tokenType: String(
                        completeWithdrawData.token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                            ? peanutInterfaces.EPeanutLinkType.native
                            : peanutInterfaces.EPeanutLinkType.erc20
                    ),
                    tokenSymbol: completeWithdrawData.token.symbol,
                    tokenDecimals: String(completeWithdrawData.token.decimals),
                    tokenAmount: completeWithdrawData.amount,
                }
                const newRequest: TRequestResponse = await requestsApi.create(apiRequestPayload)

                if (!newRequest || !newRequest.uuid) {
                    throw new Error('Failed to create request for withdrawal.')
                }

                const chargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: { amount: completeWithdrawData.amount, currency: 'USD' },
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
                setPaymentError(errorMessage)
                dispatch(paymentActions.setError(errorMessage))
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
            setPaymentError('Failed to load withdrawal details for confirmation. Please go back and try again.')
        }
    }, [activeChargeDetailsFromStore, withdrawData, setCurrentView])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!activeChargeDetailsFromStore || !withdrawData || !amountToWithdraw) {
            console.error('Withdraw data, active charge details, or amount missing for final confirmation')
            setPaymentError('Essential withdrawal information is missing.')
            return
        }

        setPaymentError(null)
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

            // reset the entire withdraw flow after successful payment
            resetTimerRef.current = setTimeout(() => {
                setAmountToWithdraw('')
                setWithdrawData(null)
                setCurrentView('INITIAL')

                // clear any errors
                setPaymentError(null)
                dispatch(paymentActions.setError(null))

                // clear charge details
                dispatch(paymentActions.setChargeDetails(null))
            }, 3000) // wait 3 seconds to show success status before resetting
        } else {
            console.error('Withdrawal execution failed:', result.error)
            const errMsg = result.error || 'Withdrawal processing failed.'
            setPaymentError(errMsg)
            dispatch(paymentActions.setError(errMsg))
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

    useEffect(
        () => () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        },
        []
    )

    const handleBackFromConfirm = useCallback(() => {
        setCurrentView('INITIAL')
        setPaymentError(null)
        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setChargeDetails(null))
    }, [dispatch, setCurrentView])

    const displayError = paymentError
    const confirmButtonDisabled = !activeChargeDetailsFromStore || isProcessing

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
                    isProcessing={confirmButtonDisabled}
                    error={displayError}
                    networkFee={feeCalculations?.estimatedFee}
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
