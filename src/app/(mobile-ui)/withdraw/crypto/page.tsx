'use client'

import ActionModal from '@/components/Global/ActionModal'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import WithdrawConfirmView from '@/components/Withdraw/views/WithdrawConfirmView'
import WithdrawSetupView from '@/components/Withdraw/views/WithdrawSetupView'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { ITokenPriceData } from '@/interfaces'
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
import { printableAddress } from '@/utils'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type WithdrawView = 'setup' | 'confirm' | 'status'

interface WithdrawData {
    token: ITokenPriceData
    chain: peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }
    address: string
    amount: string
}

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const dispatch = useAppDispatch()
    const { chargeDetails: activeChargeDetailsFromStore } = usePaymentStore()

    const [currentView, setCurrentView] = useState<WithdrawView>('setup')
    const [withdrawData, setWithdrawData] = useState<WithdrawData | null>(null)
    const [showCompatibilityModal, setShowCompatibilityModal] = useState(false)
    const [amountToWithdraw, setAmountToWithdraw] = useState<string>('')
    const [isPreparingReview, setIsPreparingReview] = useState(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)

    const {
        initiatePayment,
        isProcessing,
        error: paymentErrorFromHook,
        feeCalculations,
        prepareTransactionDetails,
    } = usePaymentInitiator()

    useEffect(() => {
        const amount = searchParams.get('amount')
        if (amount) {
            setAmountToWithdraw(amount)
        } else {
            console.error('Amount not provided for withdrawal')
        }
        dispatch(paymentActions.setChargeDetails(null))
        setPaymentError(null)
    }, [searchParams, router, dispatch])

    useEffect(() => {
        setPaymentError(paymentErrorFromHook)
    }, [paymentErrorFromHook])

    useEffect(() => {
        if (currentView === 'confirm' && activeChargeDetailsFromStore && withdrawData) {
            prepareTransactionDetails(activeChargeDetailsFromStore, false)
        }
    }, [currentView, activeChargeDetailsFromStore, withdrawData, prepareTransactionDetails])

    const handleSetupReview = useCallback(
        async (data: Omit<WithdrawData, 'amount'>) => {
            if (!amountToWithdraw) {
                console.error('Amount to withdraw is not set')
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
                console.log('Creating request for withdrawal with payload:', apiRequestPayload)
                const newRequest: TRequestResponse = await requestsApi.create(apiRequestPayload)
                console.log('Request created for withdrawal:', newRequest)

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
                }
                console.log('Creating charge for withdrawal with payload:', chargePayload)
                const createdCharge: TCharge = await chargesApi.create(chargePayload)
                console.log('Charge created (initial response):', createdCharge)

                if (!createdCharge || !createdCharge.data || !createdCharge.data.id) {
                    throw new Error('Failed to create charge for withdrawal or charge ID missing.')
                }

                const fullChargeDetails: TRequestChargeResponse = await chargesApi.get(createdCharge.data.id)
                console.log('Fetched full charge details:', fullChargeDetails)

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
        [amountToWithdraw, dispatch]
    )

    const handleCompatibilityProceed = useCallback(() => {
        setShowCompatibilityModal(false)
        if (activeChargeDetailsFromStore && withdrawData) {
            setCurrentView('confirm')
        } else {
            console.error('Proceeding to confirm, but charge details or withdraw data are missing.')
            setPaymentError('Failed to load withdrawal details for confirmation. Please go back and try again.')
        }
    }, [activeChargeDetailsFromStore, withdrawData])

    const handleConfirmWithdrawal = useCallback(async () => {
        if (!activeChargeDetailsFromStore || !withdrawData) {
            console.error('Withdraw data or active charge details missing for final confirmation')
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
            tokenAmount: withdrawData.amount,
            chargeId: activeChargeDetailsFromStore.uuid,
            skipChargeCreation: true,
        }

        console.log('Calling initiatePayment (to execute withdrawal) with payload:', paymentPayload)
        const result = await initiatePayment(paymentPayload)

        if (result.success && result.txHash) {
            console.log('Withdrawal transaction successful, txHash:', result.txHash)
            setCurrentView('status')
        } else {
            console.error('Withdrawal execution failed:', result.error)
            const errMsg = result.error || 'Withdrawal processing failed.'
            setPaymentError(errMsg)
            dispatch(paymentActions.setError(errMsg))
        }
    }, [activeChargeDetailsFromStore, withdrawData, dispatch, initiatePayment])

    const handleBackFromConfirm = useCallback(() => {
        setCurrentView('setup')
        setPaymentError(null)
        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setChargeDetails(null))
    }, [dispatch])

    const displayError = paymentError

    const confirmButtonDisabled = !activeChargeDetailsFromStore || isProcessing

    useEffect(() => {
        if (withdrawData && activeChargeDetailsFromStore) {
            setCurrentView('status')
        }
    }, [withdrawData, activeChargeDetailsFromStore])

    return (
        <div className="mx-auto h-full min-h-[inherit] w-full max-w-md space-y-4 self-center">
            {currentView === 'setup' && (
                <WithdrawSetupView
                    amount={amountToWithdraw}
                    onReview={handleSetupReview}
                    onBack={() => router.push('/withdraw')}
                    isProcessing={isPreparingReview}
                />
            )}

            {currentView === 'confirm' && withdrawData && activeChargeDetailsFromStore && (
                <WithdrawConfirmView
                    amount={withdrawData.amount}
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

            {currentView === 'status' && withdrawData && activeChargeDetailsFromStore && (
                <>
                    <DirectSuccessView
                        headerTitle="Withdraw"
                        recipientType="ADDRESS"
                        type="SEND"
                        currencyAmount={`$ ${withdrawData.amount}`}
                        isWithdrawFlow={true}
                        redirectTo="/withdraw"
                        message={`${printableAddress(withdrawData.address)}`}
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
                        icon: 'check',
                    },
                ]}
            />
        </div>
    )
}
