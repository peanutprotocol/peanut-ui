import React, { useCallback } from 'react'
import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import { ACTION_METHODS } from './ActionList'
import IconStack from '../Global/IconStack'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useCurrency } from '@/hooks/useCurrency'
import { useSearchParams } from 'next/navigation'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import DaimoPayButton from '../Global/DaimoPayButton'

const ActionListDaimoPayButton = () => {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const method = ACTION_METHODS.find((method) => method.id === 'exchange-or-wallet')
    const { requestDetails, chargeDetails, attachmentOptions, parsedPaymentData, usdAmount } = usePaymentStore()
    const {
        code: currencyCode,
        symbol: currencySymbol,
        price: currencyPrice,
    } = useCurrency(searchParams.get('currency'))
    const requestId = searchParams.get('id')

    const { isProcessing, initiateDaimoPayment, completeDaimoPayment } = usePaymentInitiator()

    const handleInitiateDaimoPayment = useCallback(async () => {
        if (!usdAmount || parseFloat(usdAmount) <= 0) {
            console.error('Invalid amount entered')
            return false
        }

        if (!parsedPaymentData) {
            console.error('Invalid payment data')
            dispatch(paymentActions.setError('Something went wrong. Please try again.'))
            return false
        }

        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setDaimoError(null))
        let tokenAmount = usdAmount

        const payload: InitiatePaymentPayload = {
            recipient: parsedPaymentData?.recipient,
            tokenAmount,
            isPintaReq: false, // explicitly set to false for non-PINTA requests
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid,
            currency: currencyCode
                ? {
                      code: currencyCode,
                      symbol: currencySymbol || '',
                      price: currencyPrice || 0,
                  }
                : undefined,
            currencyAmount: usdAmount,
            isExternalWalletFlow: false,
            transactionType: 'DIRECT_SEND',
            attachmentOptions: attachmentOptions,
        }

        console.log('Initiating Daimo payment', payload)

        const result = await initiateDaimoPayment(payload)

        if (result.status === 'Charge Created') {
            console.log('Charge created!!')
            return true
        } else if (result.status === 'Error') {
            dispatch(paymentActions.setError('Something went wrong. Please try again.'))
            console.error('Payment initiation failed:', result)
            return false
        } else {
            console.warn('Unexpected status from usePaymentInitiator:', result.status)
            dispatch(paymentActions.setError('Something went wrong. Please try again.'))
            return false
        }
    }, [
        usdAmount,
        dispatch,
        chargeDetails,
        requestDetails,
        requestId,
        parsedPaymentData,
        attachmentOptions,
        initiateDaimoPayment,
        currencyCode,
        currencySymbol,
        currencyPrice,
    ])

    const handleCompleteDaimoPayment = useCallback(
        async (daimoPaymentResponse: any) => {
            dispatch(paymentActions.setIsDaimoPaymentProcessing(true))
            if (chargeDetails) {
                const result = await completeDaimoPayment({
                    chargeDetails: chargeDetails,
                    txHash: daimoPaymentResponse.txHash as string,
                    sourceChainId: daimoPaymentResponse.payment.source.chainId,
                    payerAddress: daimoPaymentResponse.payment.source.payerAddress,
                })

                if (result.status === 'Success') {
                    dispatch(paymentActions.setView('STATUS'))
                } else if (result.status === 'Charge Created') {
                    dispatch(paymentActions.setView('CONFIRM'))
                } else if (result.status === 'Error') {
                    console.error('Payment initiation failed:', result.error)
                } else {
                    console.warn('Unexpected status from usePaymentInitiator:', result.status)
                }
                dispatch(paymentActions.setIsDaimoPaymentProcessing(false))
            }
        },
        [chargeDetails, completeDaimoPayment, dispatch]
    )

    if (!method || !parsedPaymentData) return null

    return (
        <DaimoPayButton
            amount={usdAmount ?? '0.10'}
            toAddress={parsedPaymentData.recipient.resolvedAddress}
            onPaymentCompleted={handleCompleteDaimoPayment}
            onBeforeShow={handleInitiateDaimoPayment}
            disabled={!usdAmount}
            minAmount={0.1}
            maxAmount={4000}
            loading={isProcessing}
            onValidationError={(error) => {
                dispatch(paymentActions.setDaimoError(error))
            }}
        >
            {({ onClick, loading }) => (
                <SearchResultCard
                    isDisabled={loading || isProcessing}
                    position="single"
                    description={method.description}
                    descriptionClassName="text-[12px]"
                    title={method.title}
                    onClick={onClick}
                    rightContent={<IconStack icons={method.icons} iconSize={24} />}
                />
            )}
        </DaimoPayButton>
    )
}

export default ActionListDaimoPayButton
