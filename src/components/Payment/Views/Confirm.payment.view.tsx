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
import { formatUnits } from 'viem'

type ConfirmPaymentViewProps = {
    isPintaReq?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    isAddMoneyFlow?: boolean
    /** Whether this is a direct USD payment flow (bypasses token conversion) */
    isDirectUsdPayment?: boolean
}

/**
 * Confirmation view for payment transactions. Displays payment details, fees, and handles
 * transaction execution for various payment flows including cross-chain payments, direct USD
 * payments, and add money flows.
 *
 * @param isPintaReq - Whether this is a Pinta request payment (beer payment flow)
 * @param currency - Currency details for display (code, symbol, price)
 * @param currencyAmount - Amount in the specified currency
 * @param isAddMoneyFlow - Whether this is an add money flow (deposit to wallet)
 * @param isDirectUsdPayment - Whether this bypasses token conversion and pays directly in USD
 */
export default function ConfirmPaymentView({
    isPintaReq = false,
    currency,
    currencyAmount,
    isAddMoneyFlow,
    isDirectUsdPayment = false,
}: ConfirmPaymentViewProps) {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const chargeIdFromUrl = searchParams.get('chargeId')
    const { chargeDetails, parsedPaymentData, beerQuantity, usdAmount } = usePaymentStore()
    const {
        initiatePayment,
        prepareTransactionDetails,
        isProcessing,
        isPreparingTx,
        loadingStep,
        error: paymentError,
        estimatedGasCost,
        isCalculatingFees,
        isEstimatingGas,
        isFeeEstimationError,
        cancelOperation: cancelPaymentOperation,
        xChainRoute,
    } = usePaymentInitiator()
    const { selectedTokenData, selectedChainID } = useContext(tokenSelectorContext)
    const { isConnected: isPeanutWallet, address: peanutWalletAddress, fetchBalance } = useWallet()
    const { isConnected: isWagmiConnected, address: wagmiAddress } = useAccount()
    const { rewardWalletBalance } = useWalletStore()
    const queryClient = useQueryClient()

    const networkFee = useMemo(() => {
        if (!estimatedGasCost || isPeanutWallet) return '$ 0.00'
        if (isFeeEstimationError) return '-'
        if (estimatedGasCost < 0.01) {
            return '$ <0.01'
        } else {
            return `$ ${estimatedGasCost.toFixed(2)}`
        }
    }, [estimatedGasCost, isPeanutWallet, isFeeEstimationError])

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

        return (
            isProcessing &&
            (!isPeanutWallet || !!isAddMoneyFlow) &&
            ['Switching Network', 'Sending Transaction', 'Confirming Transaction', 'Preparing Transaction'].includes(
                loadingStep
            )
        )
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
            if (isDirectUsdPayment && chargeDetails.currencyCode.toLowerCase() === 'usd') {
                prepareTransactionDetails(chargeDetails, undefined, undefined, chargeDetails.currencyAmount)
            } else {
                prepareTransactionDetails(chargeDetails)
            }
        }
    }, [
        chargeDetails,
        walletAddress,
        selectedTokenData,
        selectedChainID,
        prepareTransactionDetails,
        isDirectUsdPayment,
    ])

    const isConnected = useMemo(() => isPeanutWallet || isWagmiConnected, [isPeanutWallet, isWagmiConnected])
    const isInsufficientRewardsBalance = useMemo(() => {
        if (!isPintaReq) return false
        return Number(rewardWalletBalance) < beerQuantity
    }, [isPintaReq, rewardWalletBalance, beerQuantity])

    const isLoading = useMemo(
        () => isProcessing || isPreparingTx || isCalculatingFees || isEstimatingGas,
        [isProcessing, isPreparingTx, isCalculatingFees, isEstimatingGas]
    )

    const handleRouteRefresh = useCallback(async () => {
        if (!chargeDetails) return
        console.log('Refreshing route due to expiry...')
        await prepareTransactionDetails(chargeDetails)
    }, [chargeDetails, prepareTransactionDetails])

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
            transactionType: isAddMoneyFlow ? 'DEPOSIT' : 'REQUEST',
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

    const amountForDisplay = useMemo(() => {
        if (usdAmount) {
            return `$ ${formatAmount(Number(usdAmount))}`
        }
        return formatAmount(chargeDetails?.tokenAmount ?? '')
    }, [usdAmount, chargeDetails?.tokenAmount])

    const symbolForDisplay = useMemo(() => {
        if (usdAmount) {
            return ''
        }
        return chargeDetails?.tokenSymbol ?? ''
    }, [usdAmount, chargeDetails?.tokenSymbol])

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

    const routeTypeError = useMemo((): string | null => {
        if (!isCrossChainPayment || !xChainRoute || !isPeanutWallet) return null

        // For peanut wallet flows, only RFQ routes are allowed
        if (xChainRoute.type === 'swap') {
            return 'This route requires external wallet payment. Peanut Wallet only supports RFQ (Request for Quote) routes.'
        }

        return null
    }, [isCrossChainPayment, xChainRoute, isPeanutWallet])

    const minReceived = useMemo<string | null>(() => {
        if (!xChainRoute || !chargeDetails?.tokenDecimals) return null
        return formatUnits(BigInt(xChainRoute.rawResponse.route.estimate.toAmountMin), chargeDetails.tokenDecimals)
    }, [xChainRoute, chargeDetails?.tokenDecimals])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader
                title={isAddMoneyFlow ? 'Add Money' : 'Send'}
                onPrev={() => {
                    dispatch(paymentActions.setView('INITIAL'))
                    window.history.replaceState(null, '', `${window.location.pathname}`)
                    dispatch(paymentActions.setChargeDetails(null))
                    dispatch(paymentActions.setError(null))
                }}
            />

            <div className="my-auto flex h-full flex-col justify-center space-y-4 pb-5">
                {parsedPaymentData?.recipient && (
                    <PeanutActionDetailsCard
                        avatarSize="small"
                        transactionType={isAddMoneyFlow ? 'ADD_MONEY' : 'REQUEST_PAYMENT'}
                        recipientType={parsedPaymentData.recipient.recipientType ?? 'USERNAME'}
                        recipientName={
                            parsedPaymentData.recipient.identifier || chargeDetails?.requestLink?.recipientAddress || ''
                        }
                        amount={amountForDisplay}
                        tokenSymbol={symbolForDisplay}
                        message={chargeDetails?.requestLink?.reference ?? ''}
                        fileUrl={chargeDetails?.requestLink?.attachmentUrl ?? ''}
                        showTimer={isCrossChainPayment}
                        timerExpiry={xChainRoute?.expiry}
                        isTimerLoading={isCalculatingFees || isPreparingTx}
                        onTimerNearExpiry={handleRouteRefresh}
                        onTimerExpired={() => {
                            console.log('Route expired')
                        }}
                        disableTimerRefetch={isProcessing}
                        timerError={routeTypeError}
                    />
                )}

                <Card className="rounded-sm">
                    {minReceived && (
                        <PaymentInfoRow
                            label="Min Received"
                            value={minReceived}
                            moreInfoText="This transaction may face slippage due to token conversion or cross-chain bridging."
                        />
                    )}
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
                        value={networkFee}
                        moreInfoText={
                            isPeanutWallet
                                ? 'This transaction is sponsored by Peanut.'
                                : 'This transaction may face slippage due to token conversion or cross-chain bridging.'
                        }
                    />

                    <PaymentInfoRow hideBottomBorder label="Peanut fee" value={`$ 0.00`} />
                </Card>

                <div className="flex flex-col gap-4">
                    {paymentError ? (
                        <Button
                            disabled={isLoading}
                            onClick={handlePayment}
                            loading={isLoading}
                            shadowSize="4"
                            className="w-full"
                            icon="retry"
                            iconSize={14}
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            disabled={!isConnected || isLoading || isFeeEstimationError || !!routeTypeError}
                            onClick={handlePayment}
                            loading={isLoading}
                            shadowSize="4"
                            className="w-full"
                            icon={getIcon()}
                            iconSize={14}
                        >
                            {getButtonText()}
                        </Button>
                    )}
                    {(paymentError || routeTypeError) && (
                        <div className="space-y-2">
                            <ErrorAlert description={paymentError || routeTypeError || ''} />
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

/**
 * Displays token and chain information with icons and names.
 * Shows token icon with chain icon as a badge overlay, along with formatted text.
 *
 * @param tokenIconUrl - URL for the token icon
 * @param chainIconUrl - URL for the chain icon (displayed as overlay)
 * @param resolvedTokenSymbol - Resolved token symbol from API
 * @param fallbackTokenSymbol - Fallback token symbol if resolution fails
 * @param resolvedChainName - Resolved chain name from API
 * @param fallbackChainName - Fallback chain name if resolution fails
 */
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
