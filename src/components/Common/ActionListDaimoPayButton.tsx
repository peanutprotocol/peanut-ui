import { useCallback, useState, useRef } from 'react'
import IconStack from '../Global/IconStack'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useCurrency } from '@/hooks/useCurrency'
import { useSearchParams } from 'next/navigation'
import { type InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import DaimoPayButton from '../Global/DaimoPayButton'
import { ACTION_METHODS } from '@/constants/actionlist.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import ConfirmInviteModal from '../Global/ConfirmInviteModal'
import { ActionListCard } from '../ActionListCard'
import { DaimoPayWrapper } from '../Global/DaimoPayWrapper'

interface ActionListDaimoPayButtonProps {
    handleContinueWithPeanut: () => void
    showConfirmModal: boolean
    onBeforeShow?: () => boolean | Promise<boolean>
    isDisabled?: boolean
    clickHandlerRef?: React.MutableRefObject<(() => void) | null>
}

const ActionListDaimoPayButton = ({
    handleContinueWithPeanut,
    showConfirmModal,
    onBeforeShow,
    isDisabled,
    clickHandlerRef,
}: ActionListDaimoPayButtonProps) => {
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
    const { address: peanutWalletAddress } = useWallet()
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [confirmLoseInvite, setConfirmLoseInvite] = useState(false)
    const daimoPayButtonClickRef = useRef<(() => void) | null>(null)

    const { isProcessing, initiateDaimoPayment, completeDaimoPayment } = usePaymentInitiator()

    const handleInitiateDaimoPayment = useCallback(async () => {
        if (!usdAmount || parseFloat(usdAmount) <= 0) {
            console.error('Invalid amount entered')
            dispatch(paymentActions.setError('Invalid amount'))
            return false
        }

        if (!parsedPaymentData) {
            console.error('Invalid payment data')
            dispatch(paymentActions.setError('Something went wrong. Please try again or contact support.'))
            return false
        }

        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setDaimoError(null))
        let tokenAmount = usdAmount

        const payload: InitiatePaymentPayload = {
            recipient: parsedPaymentData?.recipient,
            tokenAmount,
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid,
            currency: currencyCode
                ? {
                      code: currencyCode,
                      symbol: currencySymbol || '',
                      price: currencyPrice?.buy || 0,
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
            dispatch(paymentActions.setError('Something went wrong. Please try again or contact support.'))
            console.error('Payment initiation failed:', result)
            return false
        } else {
            console.warn('Unexpected status from usePaymentInitiator:', result.status)
            dispatch(paymentActions.setError('Something went wrong. Please try again or contact support.'))
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
            if (chargeDetails) {
                dispatch(paymentActions.setIsDaimoPaymentProcessing(true))
                try {
                    // validate and parse destination chain id with proper fallback
                    // use chargeDetails chainId if it's a valid non-negative integer, otherwise use daimo response
                    const parsedChainId = Number(chargeDetails.chainId)
                    const destinationChainId =
                        Number.isInteger(parsedChainId) && parsedChainId >= 0
                            ? parsedChainId
                            : Number(daimoPaymentResponse.payment.destination.chainId)

                    const result = await completeDaimoPayment({
                        chargeDetails: chargeDetails,
                        txHash: daimoPaymentResponse.txHash as string,
                        destinationchainId: destinationChainId,
                        payerAddress: peanutWalletAddress ?? daimoPaymentResponse.payment.source.payerAddress,
                        sourceChainId: daimoPaymentResponse.payment.source.chainId,
                        sourceTokenAddress: daimoPaymentResponse.payment.source.tokenAddress,
                        sourceTokenSymbol: daimoPaymentResponse.payment.source.tokenSymbol,
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
                } catch (e) {
                    console.error('Error completing daimo payment:', e)
                } finally {
                    dispatch(paymentActions.setIsDaimoPaymentProcessing(false))
                }
            }
        },
        [chargeDetails, completeDaimoPayment, dispatch, peanutWalletAddress]
    )

    if (!method || !parsedPaymentData) return null

    return (
        <DaimoPayWrapper>
            <DaimoPayButton
                amount={usdAmount ?? '0.10'}
                toAddress={parsedPaymentData.recipient.resolvedAddress}
                toChainId={parsedPaymentData.chain?.chainId ? Number(parsedPaymentData.chain.chainId) : undefined}
                toTokenAddress={parsedPaymentData.token?.address}
                onPaymentCompleted={handleCompleteDaimoPayment}
                onBeforeShow={async () => {
                    // First check if parent wants to intercept (e.g. show balance modal)
                    if (onBeforeShow) {
                        const shouldProceed = await onBeforeShow()
                        if (!shouldProceed) {
                            return false
                        }
                    }

                    // Then check invite modal
                    if (!confirmLoseInvite && showConfirmModal) {
                        setShowInviteModal(true)
                        return false
                    }

                    // Finally initiate payment
                    return await handleInitiateDaimoPayment()
                }}
                disabled={!usdAmount}
                minAmount={0.1}
                maxAmount={30_000}
                loading={isProcessing}
                onValidationError={(error) => {
                    dispatch(paymentActions.setDaimoError(error))
                }}
            >
                {({ onClick, loading }) => {
                    // Store the onClick function so we can trigger it from elsewhere
                    daimoPayButtonClickRef.current = onClick
                    // also store in parent ref if provided (for balance modal in ActionList)
                    if (clickHandlerRef) {
                        clickHandlerRef.current = onClick
                    }

                    return (
                        <ActionListCard
                            isDisabled={loading || isProcessing || isDisabled}
                            position="single"
                            description={method.description}
                            descriptionClassName="text-[12px]"
                            title={method.title}
                            onClick={onClick}
                            rightContent={<IconStack icons={method.icons} iconSize={24} />}
                        />
                    )
                }}
            </DaimoPayButton>

            <ConfirmInviteModal
                method={'Exchange or wallet'}
                handleContinueWithPeanut={handleContinueWithPeanut}
                handleLoseInvite={async () => {
                    setShowInviteModal(false)
                    setConfirmLoseInvite(true)
                    // Directly initiate the Daimo payment instead of triggering button click
                    const success = await handleInitiateDaimoPayment()
                    if (success && daimoPayButtonClickRef.current) {
                        // Only trigger the actual Daimo widget if payment initiation was successful
                        daimoPayButtonClickRef.current()
                    }
                }}
                isOpen={showInviteModal}
                onClose={() => {
                    setShowInviteModal(false)
                    // Reset confirmLoseInvite when modal is closed without proceeding
                    setConfirmLoseInvite(false)
                }}
            />
        </DaimoPayWrapper>
    )
}

export default ActionListDaimoPayButton
