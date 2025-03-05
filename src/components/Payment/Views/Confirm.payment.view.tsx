'use client'

import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import {
    ErrorHandler,
    formatTokenAmount,
    getTokenSymbol,
    isAddressZero,
    switchNetwork as switchNetworkUtil,
    areEvmAddressesEqual,
} from '@/utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useSwitchChain } from 'wagmi'
import { PaymentInfoRow } from '../PaymentInfoRow'

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const { isConnected, chain: currentChain, address, isPeanutWallet } = useWallet()
    const { attachmentOptions, parsedPaymentData, error, chargeDetails } = usePaymentStore()
    const { selectedTokenData, selectedChainID, isXChain, setIsXChain, selectedTokenAddress } =
        useContext(tokenSelectorContext)
    const [isFeeEstimationError, setIsFeeEstimationError] = useState<boolean>(false)
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [isCalculatingFees, setIsCalculatingFees] = useState(false)
    const [isEstimatingGas, setIsEstimatingGas] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { sendTransactions, checkUserHasEnoughBalance, estimateGasFee } = useCreateLink()
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>()
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<
        peanutInterfaces.IPeanutUnsignedTransaction[] | undefined
    >()
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const { switchChainAsync } = useSwitchChain()
    const { setLoadingState } = useContext(loadingStateContext)
    const [txFee, setTxFee] = useState<string>('0')
    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)

    // call charges service to get chargeDetails details
    useEffect(() => {
        if (chargeId) {
            chargesApi
                .get(chargeId)
                .then((chargeDetails) => {
                    dispatch(paymentActions.setChargeDetails(chargeDetails))
                })
                .catch((error) => {
                    const errorString = ErrorHandler(error)
                    dispatch(paymentActions.setError(errorString))
                })
        }
    }, [chargeId, dispatch])

    // Check if cross-chain based on chargeDetails
    const isXChainTx = useMemo(() => {
        if (!chargeDetails || !selectedChainID) return false
        return selectedChainID !== chargeDetails.chainId
    }, [chargeDetails, selectedChainID])

    const createXChainUnsignedTx = async (tokenData: any, requestLink: any, senderAddress: string) => {
        console.log('Creating cross-chain tx with:', { tokenData, requestLink, senderAddress })

        // ensure required data
        if (!tokenData?.address || !tokenData?.chainId || !tokenData?.decimals) {
            throw new Error('Invalid token data for cross-chain transaction')
        }

        try {
            // prepare link details
            const linkDetails = {
                recipientAddress: requestLink.recipientAddress,
                chainId: requestLink.chainId.toString(),
                tokenAmount: requestLink.tokenAmount,
                tokenAddress: requestLink.tokenAddress,
                tokenDecimals: requestLink.tokenDecimals,
                tokenType: Number(requestLink.tokenType),
            }

            // prepare unsigned tx
            const xchainUnsignedTxs = await peanut.prepareXchainRequestFulfillmentTransaction({
                fromToken: tokenData.address,
                fromChainId: tokenData.chainId,
                senderAddress,
                squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
                provider: await peanut.getDefaultProvider(tokenData.chainId),
                tokenType: isAddressZero(tokenData.address)
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20,
                fromTokenDecimals: tokenData.decimals,
                linkDetails,
            })

            if (!xchainUnsignedTxs) {
                throw new Error('Failed to prepare cross-chain transaction')
            }

            if (xchainUnsignedTxs.estimatedFromAmount) {
                setEstimatedFromValue(xchainUnsignedTxs.estimatedFromAmount)
            }

            return xchainUnsignedTxs
        } catch (error) {
            console.error('Cross-chain preparation error:', error)
            throw new Error(error instanceof Error ? error.message : 'Failed to estimate from amount')
        }
    }

    // prepare transaction
    const prepareTransaction = async () => {
        if (!chargeDetails || !address) return

        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            setIsXChain(isXChainTx)

            // prepare cross-chain tx
            if (
                isXChainTx ||
                (selectedTokenData && !areEvmAddressesEqual(selectedTokenData.address, chargeDetails.tokenAddress))
            ) {
                if (!selectedTokenData) {
                    throw new Error('Token data not found')
                }

                const txData = await createXChainUnsignedTx(
                    {
                        address: selectedTokenData.address,
                        chainId: selectedTokenData.chainId,
                        decimals: selectedTokenData.decimals,
                    },
                    {
                        recipientAddress: chargeDetails.requestLink.recipientAddress,
                        chainId: chargeDetails.chainId,
                        tokenAmount: chargeDetails.tokenAmount,
                        tokenAddress: chargeDetails.tokenAddress,
                        tokenDecimals: chargeDetails.tokenDecimals,
                        tokenType: chargeDetails.tokenType,
                    },
                    address
                )

                if (!txData?.unsignedTxs) {
                    throw new Error('Failed to prepare cross-chain transaction')
                }

                setXChainUnsignedTxs(txData.unsignedTxs)
                setEstimatedFromValue(txData.estimatedFromAmount)
                setTxFee(txData.feeEstimation)
                setSlippagePercentage(txData.slippagePercentage)
            } else {
                // prepare same-chain transaction
                const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: chargeDetails.requestLink.recipientAddress,
                    tokenAddress: chargeDetails.tokenAddress,
                    tokenAmount: chargeDetails.tokenAmount,
                    tokenDecimals: chargeDetails.tokenDecimals,
                    tokenType: Number(chargeDetails.tokenType) as peanutInterfaces.EPeanutLinkType,
                })

                if (!tx?.unsignedTx) {
                    throw new Error('Failed to prepare transaction')
                }

                setUnsignedTx(tx.unsignedTx)
                setEstimatedFromValue(chargeDetails.tokenAmount)
            }
        } catch (error) {
            console.error('Failed to prepare transaction:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
            return false
        } finally {
            setIsSubmitting(false)
        }
        return true
    }

    // prepare transaction when chargeDetails is ready
    useEffect(() => {
        prepareTransaction()
    }, [chargeDetails, address, selectedChainID, selectedTokenData])

    // reset error when component mounts
    useEffect(() => {
        dispatch(paymentActions.setError(null))
    }, [dispatch])

    // handle payment
    const handlePayment = async () => {
        if (!isConnected || !address || !chargeDetails) return
        if (isXChain && !xChainUnsignedTxs) {
            dispatch(paymentActions.setError('Cross-chain transaction not ready'))
            return
        }
        if (!isXChain && !unsignedTx) {
            dispatch(paymentActions.setError('Transaction not ready'))
            return
        }

        setIsCalculatingFees(false)
        setIsEstimatingGas(false)
        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            // check balance and switch network
            await checkUserHasEnoughBalance({
                tokenValue: isXChain ? estimatedFromValue : chargeDetails.tokenAmount,
            })

            if (selectedChainID !== String(currentChain?.id)) {
                await switchNetworkUtil({
                    chainId: selectedChainID,
                    currentChainId: String(currentChain?.id),
                    setLoadingState,
                    switchChainAsync: async ({ chainId: _chainId }) => {
                        await switchChainAsync({ chainId: Number(selectedChainID) })
                    },
                })
            }

            // sign and send transaction
            const hash = await sendTransactions({
                preparedDepositTxs: {
                    unsignedTxs: isXChain
                        ? (xChainUnsignedTxs as peanutInterfaces.IPeanutUnsignedTransaction[])
                        : [unsignedTx as peanutInterfaces.IPeanutUnsignedTransaction],
                },
                feeOptions: undefined,
            })

            if (!hash) {
                throw new Error('Failed to send transaction')
            }

            // set the transaction hash
            dispatch(paymentActions.setTransactionHash(hash))

            // update payment details in backend
            const paymentDetails = await chargesApi.createPayment({
                chargeId: chargeDetails.uuid,
                chainId: selectedChainID,
                hash,
                tokenAddress: selectedTokenData!.address,
            })

            dispatch(paymentActions.setPaymentDetails(paymentDetails))
            dispatch(paymentActions.setView('STATUS'))
        } catch (error) {
            console.error('Error processing payment:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
        } finally {
            setIsSubmitting(false)
        }
    }

    // Get button text based on state
    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isSubmitting) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span>{isXChainTx ? 'Fetching Best Quote For You...' : 'Preparing Transaction...'}</span>
                </div>
            )
        }
        if (isCalculatingFees || isEstimatingGas) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span>Calculating Fees...</span>
                </div>
            )
        }
        return 'Confirm Payment'
    }

    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage || !estimatedFromValue) return null

        const slippageAmount = (slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)

        return isNaN(slippageAmount) ? null : slippageAmount.toFixed(2)
    }, [slippagePercentage, selectedTokenData?.price, estimatedFromValue])

    // estimate gas fee when unsignedTx is ready
    useEffect(() => {
        if (!chargeDetails || !unsignedTx) return

        setIsEstimatingGas(true)
        estimateGasFee({
            chainId: isXChain ? selectedChainID : chargeDetails.chainId,
            preparedTx: unsignedTx,
        })
            .then(({ transactionCostUSD }) => {
                if (transactionCostUSD) setEstimatedGasCost(transactionCostUSD)
            })
            .catch((error) => {
                console.error('Error calculating transaction cost:', error)
                setIsFeeEstimationError(true)
                dispatch(paymentActions.setError('Failed to estimate gas fee'))
            })
            .finally(() => {
                setIsEstimatingGas(false)
            })
    }, [unsignedTx, chargeDetails, isXChain, selectedChainID])

    // calculate fee details
    const [feeCalculations, setFeeCalculations] = useState({
        networkFee: { expected: '0.00', max: '0.00' },
        slippage: undefined as { expected: string; max: string } | undefined,
        estimatedFee: '0.00',
        totalMax: '0.00',
    })

    useEffect(() => {
        const EXPECTED_NETWORK_FEE_MULTIPLIER = 0.7
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1
        setIsCalculatingFees(true)
        if (isSubmitting) return

        try {
            const networkFee = {
                expected:
                    (isXChain
                        ? parseFloat(txFee) * EXPECTED_NETWORK_FEE_MULTIPLIER
                        : isPeanutWallet
                          ? 0
                          : Number(estimatedGasCost || 0)) * EXPECTED_NETWORK_FEE_MULTIPLIER,
                max: isXChain ? parseFloat(txFee) : isPeanutWallet ? 0 : Number(estimatedGasCost || 0),
            }

            const slippage =
                isXChain && calculatedSlippage
                    ? {
                          expected: Number(calculatedSlippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
                          max: Number(calculatedSlippage),
                      }
                    : undefined

            const totalMax =
                Number(estimatedFromValue) * selectedTokenData!.price + networkFee.max + (slippage?.max || 0)

            const formatNumberSafely = (num: number) => {
                if (isNaN(num) || !isFinite(num)) return '0.00'
                return num < 0.01 && num > 0 ? '0.01' : num.toFixed(2)
            }

            setFeeCalculations({
                networkFee: {
                    expected: formatNumberSafely(networkFee.expected),
                    max: formatNumberSafely(networkFee.max),
                },
                slippage: slippage
                    ? {
                          expected: formatNumberSafely(slippage.expected),
                          max: formatNumberSafely(slippage.max),
                      }
                    : undefined,
                estimatedFee: formatNumberSafely(networkFee.expected + (slippage?.expected || 0)),
                totalMax: formatNumberSafely(totalMax),
            })

            const timer = setTimeout(() => {
                setIsCalculatingFees(false)
            }, 300)
            return () => clearTimeout(timer)
        } catch (error) {
            console.error('Error calculating fees:', error)
            setIsFeeEstimationError(true)
            setIsCalculatingFees(false)
            setFeeCalculations({
                networkFee: { expected: '0.00', max: '0.00' },
                slippage: undefined,
                estimatedFee: '0.00',
                totalMax: '0.00',
            })
        }
    }, [
        isXChain,
        txFee,
        calculatedSlippage,
        chargeDetails,
        selectedTokenData,
        isPeanutWallet,
        estimatedGasCost,
        estimatedFromValue,
        selectedTokenData,
    ])

    if (!chargeDetails) return <PeanutLoading />

    return (
        <div className="space-y-4">
            <FlowHeader
                onPrev={() => {
                    dispatch(paymentActions.setView('INITIAL'))
                    window.history.replaceState(null, '', `${window.location.pathname}`)
                    dispatch(paymentActions.setChargeDetails(null))
                }}
                disableWalletHeader
            />
            <div className="text-start text-h4 font-bold">Confirm Details</div>
            <div className="">
                <PaymentInfoRow
                    label="Recipient"
                    value={parsedPaymentData?.recipient?.identifier || chargeDetails?.requestLink?.recipientAddress}
                />

                <PaymentInfoRow
                    loading={isCalculatingFees || isEstimatingGas}
                    label="You are paying"
                    value={`${formatTokenAmount(Number(estimatedFromValue))} ${getTokenSymbol(selectedTokenAddress, selectedChainID)} on ${getReadableChainName(selectedChainID)}`}
                />

                <PaymentInfoRow
                    loading={isCalculatingFees || isEstimatingGas}
                    label={`${parsedPaymentData?.recipient.identifier} will receive`}
                    value={`${formatTokenAmount(Number(chargeDetails!.tokenAmount))} ${chargeDetails?.tokenSymbol} on ${getReadableChainName(chargeDetails.chainId)}`}
                />

                {attachmentOptions.fileUrl && (
                    <PaymentInfoRow
                        label="Attachment"
                        value={
                            <a
                                href={attachmentOptions.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-start text-sm font-semibold leading-4 hover:underline"
                            >
                                <span>Download </span>
                                <Icon name={'download'} className="h-4 fill-grey-1" />
                            </a>
                        }
                    />
                )}

                {attachmentOptions?.message && (
                    <div
                        onClick={() => setShowMessage(!showMessage)}
                        className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black py-3"
                    >
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'email'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Message</div>
                            </div>
                            <Icon
                                name={'arrow-bottom'}
                                className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && 'rotate-180'}`}
                            />
                        </div>

                        {showMessage && (
                            <div className="flex w-full flex-col items-center justify-center gap-1 py-1 text-h8 text-grey-1">
                                <div className="w-full text-start text-sm font-normal leading-4">
                                    {attachmentOptions.message}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Fee Details Section */}
                {!isFeeEstimationError && (
                    <div className="space-y-1">
                        {feeCalculations.estimatedFee && feeCalculations.slippage && (
                            <PaymentInfoRow
                                loading={isCalculatingFees || isEstimatingGas}
                                label="Estimated Fee"
                                value={`$${feeCalculations.estimatedFee}`}
                            />
                        )}

                        {feeCalculations.networkFee && (
                            <PaymentInfoRow
                                loading={isCalculatingFees || isEstimatingGas}
                                label="Network Fee"
                                value={`$${isPeanutWallet ? 0 : feeCalculations.networkFee.max}`}
                                moreInfoText={
                                    isPeanutWallet
                                        ? 'This transaction is sponsored by peanut! Enjoy!'
                                        : 'Maximum network fee you might pay for this transaction.'
                                }
                            />
                        )}

                        {feeCalculations.slippage && (
                            <PaymentInfoRow
                                loading={isCalculatingFees || isEstimatingGas}
                                label="Max Slippage"
                                value={`$${feeCalculations.slippage.max}`}
                                moreInfoText={`Maximum slippage that might occur during the cross-chain swap.`}
                            />
                        )}

                        {feeCalculations.totalMax && (
                            <PaymentInfoRow
                                loading={isCalculatingFees || isEstimatingGas}
                                label="Max you will pay"
                                value={`$${feeCalculations.totalMax}`}
                                moreInfoText={
                                    isXChain
                                        ? 'Maximum amount you will pay including requested amount, network fees, and maximum slippage.'
                                        : 'Maximum amount you will pay including requested amount and network fees.'
                                }
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking the back
                button on the top left corner.
            </div>

            <div className="flex flex-col gap-2">
                {error && (
                    <div className="space-y-2">
                        <ErrorAlert description={error} />

                        {!error.includes('Please confirm the request in your wallet.') && (
                            <Button
                                onClick={prepareTransaction}
                                disabled={isSubmitting}
                                variant="transparent-dark"
                                className="w-full"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Retrying...</span>
                                    </div>
                                ) : (
                                    'Retry'
                                )}
                            </Button>
                        )}
                    </div>
                )}
                <Button
                    disabled={
                        !isConnected || isSubmitting || isCalculatingFees || isEstimatingGas || isFeeEstimationError
                    }
                    onClick={handlePayment}
                    loading={isSubmitting || isCalculatingFees || isEstimatingGas}
                    shadowSize="4"
                    className="w-full"
                >
                    {getButtonText()}
                </Button>
            </div>
        </div>
    )
}
