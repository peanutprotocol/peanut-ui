'use client'

import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import { IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import PintaReqViewWrapper from '@/components/PintaReqPay/PintaReqViewWrapper'
import { TRANSACTIONS } from '@/constants/query.consts'
import { tokenSelectorContext } from '@/context'
import { usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, usePaymentStore, useWalletStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { ErrorHandler, formatAmount, printableAddress } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { PaymentInfoRow } from '../PaymentInfoRow'

type ConfirmPaymentViewProps = {
    isPintaReq?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    isAddMoneyFlow?: boolean
}

export default function ConfirmPaymentView({
    isPintaReq = false,
    currency,
    currencyAmount,
    isAddMoneyFlow,
}: ConfirmPaymentViewProps) {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const chargeIdFromUrl = searchParams.get('chargeId')
    const { chargeDetails, parsedPaymentData, beerQuantity } = usePaymentStore()
    const {
        initiatePayment,
        prepareTransactionDetails,
        isProcessing,
        isPreparingTx,
        loadingStep,
        error: paymentError,
        feeCalculations,
        isCalculatingFees,
        isEstimatingGas,
        isFeeEstimationError,
        cancelOperation: cancelPaymentOperation,
    } = usePaymentInitiator()
    const { selectedTokenData, selectedChainID } = useContext(tokenSelectorContext)
    const { isConnected: isPeanutWallet, address: peanutWalletAddress, fetchBalance } = useWallet()
    const { isConnected: isWagmiConnected, address: wagmiAddress } = useAccount()
    const { rewardWalletBalance } = useWalletStore()
    const queryClient = useQueryClient()

    const walletAddress = useMemo(() => peanutWalletAddress ?? wagmiAddress, [peanutWalletAddress, wagmiAddress])

    const {
        tokenIconUrl: sendingTokenIconUrl,
        chainIconUrl: sendingChainIconUrl,
        resolvedChainName: sendingResolvedChainName,
        resolvedTokenSymbol: sendingResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: selectedChainID,
        tokenAddress: selectedTokenData?.address,
        tokenSymbol: selectedTokenData?.symbol,
    })

    const {
        tokenIconUrl: requestedTokenIconUrl,
        chainIconUrl: requestedChainIconUrl,
        resolvedChainName: requestedResolvedChainName,
        resolvedTokenSymbol: requestedResolvedTokenSymbol,
    } = useTokenChainIcons({
        chainId: chargeDetails?.chainId,
        tokenAddress: chargeDetails?.tokenAddress,
        tokenSymbol: chargeDetails?.tokenSymbol,
    })

    const showExternalWalletConfirmationModal = useMemo((): boolean => {
        if (isCalculatingFees || isEstimatingGas) return false

        return isProcessing && (!isPeanutWallet || isAddMoneyFlow)
            ? ['Switching Network', 'Sending Transaction', 'Confirming Transaction', 'Preparing Transaction'].includes(
                  loadingStep
              )
            : false
    }, [isProcessing, isPeanutWallet, loadingStep, isAddMoneyFlow, isCalculatingFees, isEstimatingGas])

    useEffect(() => {
        if (chargeIdFromUrl && !chargeDetails) {
            chargesApi
                .get(chargeIdFromUrl)
                .then((fetchedChargeDetails) => {
                    dispatch(paymentActions.setChargeDetails(fetchedChargeDetails))
                })
                .catch((error) => {
                    const errorString = ErrorHandler(error)
                    dispatch(paymentActions.setError(errorString))
                    dispatch(paymentActions.setChargeDetails(null))
                })
        } else if (!chargeIdFromUrl && !chargeDetails) {
            dispatch(paymentActions.setError('Payment details are missing. Please go back and try again.'))
        }
    }, [chargeIdFromUrl, chargeDetails, dispatch])

    useEffect(() => {
        if (chargeDetails && selectedTokenData && selectedChainID) {
            prepareTransactionDetails(chargeDetails, isAddMoneyFlow)
        }
    }, [chargeDetails, walletAddress, selectedTokenData, selectedChainID, prepareTransactionDetails, isAddMoneyFlow])

    const isConnected = useMemo(() => isPeanutWallet || isWagmiConnected, [isPeanutWallet, isWagmiConnected])
    const isInsufficientRewardsBalance = useMemo(() => {
        if (!isPintaReq) return false
        return Number(rewardWalletBalance) < beerQuantity
    }, [isPintaReq, rewardWalletBalance, beerQuantity])

    const isLoading = useMemo(
        () => isProcessing || isPreparingTx || isCalculatingFees || isEstimatingGas,
        [isProcessing, isPreparingTx, isCalculatingFees, isEstimatingGas]
    )

    const handlePayment = useCallback(async () => {
        if (!chargeDetails || !parsedPaymentData) return

        if (isPintaReq && beerQuantity <= 0) {
            dispatch(paymentActions.setError('Please select at least 1 beer to continue.'))
            return
        }

        const result = await initiatePayment({
            recipient: parsedPaymentData.recipient,
            tokenAmount: isPintaReq ? beerQuantity.toString() : chargeDetails.tokenAmount,
            isPintaReq: isPintaReq,
            chargeId: chargeDetails.uuid,
            skipChargeCreation: true,
            currency,
            currencyAmount,
            isAddMoneyFlow: !!isAddMoneyFlow,
        })

        if (result.success) {
            setTimeout(() => {
                fetchBalance()
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            }, 3000)
            dispatch(paymentActions.setView('STATUS'))
        }
    }, [
        chargeDetails,
        initiatePayment,
        parsedPaymentData,
        dispatch,
        isPintaReq,
        beerQuantity,
        fetchBalance,
        queryClient,
        currency,
        currencyAmount,
        isAddMoneyFlow,
    ])

    const getButtonText = useCallback(() => {
        if (isProcessing) {
            if (isAddMoneyFlow) return 'Adding money'
            return loadingStep === 'Idle' ? 'Send' : 'Sending'
        }
        if (isAddMoneyFlow) return 'Add Money'
        if (isEstimatingGas || isCalculatingFees || isPreparingTx) return 'Send'
        if (isPintaReq) return 'Confirm Payment'
        return 'Send'
    }, [isProcessing, loadingStep, isPreparingTx, isEstimatingGas, isCalculatingFees, isPintaReq, isAddMoneyFlow])

    const getIcon = useCallback((): IconName | undefined => {
        if (isAddMoneyFlow) return 'arrow-down'
        if (isProcessing) return undefined
        return 'arrow-up-right'
    }, [isAddMoneyFlow])

    if (!chargeDetails && !paymentError) {
        return chargeIdFromUrl ? <PeanutLoading /> : null
    }

    if (!chargeDetails && paymentError) {
        const message = paymentError
        const handleGoBack = () => {
            dispatch(paymentActions.setView('INITIAL'))
            window.history.replaceState(null, '', `${window.location.pathname}`)
            dispatch(paymentActions.setChargeDetails(null))
            dispatch(paymentActions.setError(null))
        }
        return (
            <div className="space-y-4 text-center">
                <ErrorAlert description={message} />
                <Button onClick={handleGoBack}>Go Back</Button>
            </div>
        )
    }

    if (isPintaReq) {
        return (
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('INITIAL'))
                        window.history.replaceState(null, '', `${window.location.pathname}`)
                        dispatch(paymentActions.setChargeDetails(null))
                        dispatch(paymentActions.setError(null))
                    }}
                />
                <PintaReqViewWrapper view="CONFIRM">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You're paying for</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {beerQuantity} {beerQuantity > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-normal">From your Beer Account</p>
                        </div>
                    </div>
                    <PeanutSponsored />
                    <Divider />
                    <Button
                        variant="purple"
                        onClick={handlePayment}
                        disabled={
                            !isConnected ||
                            isLoading ||
                            isInsufficientRewardsBalance ||
                            beerQuantity <= 0 ||
                            isFeeEstimationError
                        }
                        loading={isLoading}
                    >
                        {getButtonText()}
                    </Button>
                    {beerQuantity <= 0 && <ErrorAlert description="Please select at least 1 beer to continue." />}
                    {isInsufficientRewardsBalance && (
                        <ErrorAlert
                            description={`You do not have enough balance in your Beer Account to claim ${beerQuantity} beers.`}
                        />
                    )}
                    {paymentError && <ErrorAlert description={paymentError} />}
                </PintaReqViewWrapper>
            </div>
        )
    }

    const isCrossChainPayment = useMemo((): boolean => {
        if (!chargeDetails || !selectedTokenData || !selectedChainID) return false

        return chargeDetails.chainId !== selectedChainID
    }, [chargeDetails, selectedTokenData, selectedChainID])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader
                title="Send"
                onPrev={() => {
                    dispatch(paymentActions.setView('INITIAL'))
                    window.history.replaceState(null, '', `${window.location.pathname}`)
                    dispatch(paymentActions.setChargeDetails(null))
                    dispatch(paymentActions.setError(null))
                }}
            />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {parsedPaymentData?.recipient && (
                    <PeanutActionDetailsCard
                        avatarSize="small"
                        transactionType={isAddMoneyFlow ? 'ADD_MONEY' : 'REQUEST_PAYMENT'}
                        recipientType={parsedPaymentData.recipient.recipientType ?? 'USERNAME'}
                        recipientName={
                            parsedPaymentData.recipient.identifier || chargeDetails?.requestLink?.recipientAddress || ''
                        }
                        amount={formatAmount(chargeDetails?.tokenAmount ?? '')}
                        tokenSymbol={chargeDetails?.tokenSymbol ?? ''}
                        message={chargeDetails?.requestLink?.reference ?? ''}
                        fileUrl={chargeDetails?.requestLink?.attachmentUrl ?? ''}
                    />
                )}

                <Card className="rounded-sm">
                    {isCrossChainPayment && (
                        <PaymentInfoRow
                            label="Requested"
                            value={
                                <TokenChainInfoDisplay
                                    tokenIconUrl={requestedTokenIconUrl}
                                    chainIconUrl={requestedChainIconUrl}
                                    resolvedTokenSymbol={requestedResolvedTokenSymbol}
                                    fallbackTokenSymbol={selectedTokenData?.symbol || ''}
                                    resolvedChainName={requestedResolvedChainName}
                                    fallbackChainName={selectedChainID || ''}
                                />
                            }
                        />
                    )}
                    <PaymentInfoRow
                        label={isCrossChainPayment ? `Sending` : 'Token and network'}
                        value={
                            <TokenChainInfoDisplay
                                tokenIconUrl={sendingTokenIconUrl}
                                chainIconUrl={sendingChainIconUrl}
                                resolvedTokenSymbol={sendingResolvedTokenSymbol}
                                fallbackTokenSymbol={selectedTokenData?.symbol || ''}
                                resolvedChainName={sendingResolvedChainName}
                                fallbackChainName={selectedChainID || ''}
                            />
                        }
                    />

                    {isAddMoneyFlow && <PaymentInfoRow label="From" value={printableAddress(wagmiAddress ?? '')} />}

                    <PaymentInfoRow
                        loading={isCalculatingFees || isEstimatingGas || isPreparingTx}
                        label={isCrossChainPayment ? 'Max network fee' : 'Network fee'}
                        value={
                            isFeeEstimationError ? '-' : isPeanutWallet ? '$ 0.00' : `$ ${feeCalculations.estimatedFee}`
                        }
                        moreInfoText={
                            isPeanutWallet
                                ? 'This transaction is sponsored by Peanut.'
                                : 'This transaction may face slippage due to token conversion or cross-chain bridging.'
                        }
                    />

                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value={`$ 0.00`} />
                </Card>

                <div className="flex flex-col gap-4">
                    <Button
                        disabled={!isConnected || isLoading || isFeeEstimationError}
                        onClick={handlePayment}
                        loading={isLoading}
                        shadowSize="4"
                        className="w-full"
                        icon={getIcon()}
                        iconSize={14}
                    >
                        {getButtonText()}
                    </Button>
                    {paymentError && (
                        <div className="space-y-2">
                            <ErrorAlert description={paymentError} />
                        </div>
                    )}
                </div>
                <ActionModal
                    visible={showExternalWalletConfirmationModal}
                    onClose={() => {
                        cancelPaymentOperation()
                    }}
                    title="Continue in your wallet"
                    description="Please confirm the transaction in your wallet app to proceed."
                    isLoadingIcon={true}
                    preventClose={true}
                />
            </div>
        </div>
    )
}

interface TokenChainInfoDisplayProps {
    tokenIconUrl?: string
    chainIconUrl?: string
    resolvedTokenSymbol?: string
    fallbackTokenSymbol: string
    resolvedChainName?: string
    fallbackChainName: string
}

function TokenChainInfoDisplay({
    tokenIconUrl,
    chainIconUrl,
    resolvedTokenSymbol,
    fallbackTokenSymbol,
    resolvedChainName,
    fallbackChainName,
}: TokenChainInfoDisplayProps) {
    const tokenSymbol = resolvedTokenSymbol || fallbackTokenSymbol
    const chainName = resolvedChainName || fallbackChainName

    return (
        <div className="flex items-center gap-2">
            {(tokenIconUrl || chainIconUrl) && (
                <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                    {tokenIconUrl && (
                        <DisplayIcon
                            iconUrl={tokenIconUrl}
                            altText={`${tokenSymbol} token`}
                            fallbackName={tokenSymbol.charAt(0) || 'T'}
                            sizeClass="h-6 w-6"
                        />
                    )}
                    {chainIconUrl && (
                        <div className="absolute -bottom-1 -right-1">
                            <DisplayIcon
                                iconUrl={chainIconUrl}
                                altText={`${chainName} chain`}
                                fallbackName={chainName.charAt(0) || 'C'}
                                sizeClass="h-3.5 w-3.5"
                                className="rounded-full border-2 border-white dark:border-grey-4"
                            />
                        </div>
                    )}
                </div>
            )}
            <span>
                {tokenSymbol} on <span className="capitalize">{chainName}</span>
            </span>
        </div>
    )
}
