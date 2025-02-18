'use client'

import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FeeDescription from '@/components/Global/FeeDescription'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { supportedPeanutChains } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ITokenPriceData } from '@/interfaces'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import {
    ErrorHandler,
    fetchTokenPrice,
    isAddressZero,
    printableAddress,
    switchNetwork as switchNetworkUtil,
} from '@/utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useSwitchChain } from 'wagmi'

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const { isConnected, chain: currentChain, address } = useWallet()
    const { attachmentOptions, urlParams, error, chargeDetails, resolvedAddress } = usePaymentStore()
    const { selectedChainID, selectedTokenData } = useContext(tokenSelectorContext)

    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [tokenPriceData, setTokenPriceData] = useState<ITokenPriceData | undefined>(undefined)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const { sendTransactions, checkUserHasEnoughBalance } = useCreateLink()
    // todo: use redux store for this
    const [transactionHash, setTransactionHash] = useState<string>('')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>()
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<
        peanutInterfaces.IPeanutUnsignedTransaction[] | undefined
    >()
    const [isXChain, setIsXChain] = useState(false)
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const { switchChainAsync } = useSwitchChain()
    const { setLoadingState } = useContext(loadingStateContext)
    const [txFee, setTxFee] = useState<string>('0')
    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)

    // Get selected chain details
    const selectedChain = supportedPeanutChains.find((chain) => chain.chainId.toString() === selectedChainID)

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

    useEffect(() => {
        if (!chargeDetails) return

        fetchTokenPrice(chargeDetails.tokenAddress.toLowerCase(), chargeDetails.chainId).then((tokenPriceData) => {
            if (tokenPriceData) {
                setTokenPriceData(tokenPriceData)
            } else {
                dispatch(paymentActions.setError('Failed to fetch token price'))
            }
        })
    }, [chargeDetails, dispatch])

    // Check if cross-chain based on chargeDetails
    const isXChainTx = useMemo(() => {
        if (!chargeDetails || !selectedChainID) return false
        return selectedChainID !== chargeDetails.chainId
    }, [chargeDetails, selectedChainID])

    // helper function to prepare cross-chain tx
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

            return {
                unsignedTxs: xchainUnsignedTxs.unsignedTxs,
                estimatedFromAmount: xchainUnsignedTxs.estimatedFromAmount,
            }
        } catch (error) {
            console.error('Cross-chain preparation error:', error)
            throw new Error(error instanceof Error ? error.message : 'Failed to estimate from amount')
        }
    }

    // prepare transaction
    const prepareTransaction = async () => {
        if (!chargeDetails || !address) return

        setIsLoading(true)
        dispatch(paymentActions.setError(null))

        try {
            setIsXChain(isXChainTx)

            // prepare cross-chain tx
            if (isXChainTx) {
                if (!selectedTokenData) {
                    throw new Error('Token data not found')
                }

                const txData = await createXChainUnsignedTx(
                    {
                        address: selectedTokenData.address,
                        chainId: selectedChainID,
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
            } else {
                const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: chargeDetails.requestLink.recipientAddress,
                    tokenAddress: chargeDetails.tokenAddress,
                    tokenAmount: chargeDetails.tokenAmount,
                    tokenDecimals: chargeDetails.tokenDecimals,
                    tokenType: Number(chargeDetails.tokenType),
                })

                if (!tx?.unsignedTx) {
                    throw new Error('Failed to prepare transaction')
                }

                setUnsignedTx(tx.unsignedTx)
            }
        } catch (error) {
            console.error('Failed to prepare transaction:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
            return false
        } finally {
            setIsLoading(false)
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

        setIsLoading(true)
        dispatch(paymentActions.setError(null))

        try {
            // check balance and switch network
            await checkUserHasEnoughBalance({
                tokenValue: isXChain ? estimatedFromValue : chargeDetails.tokenAmount,
            })

            const targetChainId = isXChain ? selectedChainID : chargeDetails.chainId
            if (targetChainId !== String(currentChain?.id)) {
                await switchNetworkUtil({
                    chainId: targetChainId,
                    currentChainId: String(currentChain?.id),
                    setLoadingState,
                    switchChainAsync: async ({ chainId }) => {
                        await switchChainAsync({ chainId: Number(targetChainId) })
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

            // set the transaction hash
            dispatch(paymentActions.setTransactionHash(hash ?? ''))

            // update payment details in backend
            const paymentDetails = await chargesApi.createPayment({
                chargeId: chargeDetails.uuid,
                chainId: selectedChainID,
                hash: hash || '',
                tokenAddress: isXChain ? selectedTokenData?.address || '' : chargeDetails.tokenAddress,
            })

            dispatch(paymentActions.setPaymentDetails(paymentDetails))
            dispatch(paymentActions.setView('SUCCESS'))
        } catch (error) {
            console.error('Error processing payment:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
        } finally {
            setIsLoading(false)
        }
    }

    // Get button text based on state
    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🥜</span>
                    <span>{isXChainTx ? 'Fetching Best Quote For You...' : 'Preparing Transaction...'}</span>
                </div>
            )
        }
        return 'Confirm Payment'
    }

    // Add this useMemo for slippage calculation
    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage) return null
        return ((slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)).toFixed(2)
    }, [slippagePercentage, selectedTokenData, estimatedFromValue])

    // Add this useMemo for fee calculations
    const feeCalculations = useMemo(() => {
        const EXPECTED_NETWORK_FEE_MULTIPLIER = 0.7
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1

        const networkFee = {
            expected: isXChain ? Number(txFee) * EXPECTED_NETWORK_FEE_MULTIPLIER : 0,
            max: isXChain ? Number(txFee) : 0,
        }

        const slippage = calculatedSlippage
            ? {
                  expected: Number(calculatedSlippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
                  max: Number(calculatedSlippage),
              }
            : undefined

        const requestedAmountUSD = chargeDetails?.tokenAmount
            ? Number(chargeDetails.tokenAmount) * (selectedTokenData?.price || 0)
            : 0

        const totalMax = requestedAmountUSD + networkFee.max + (slippage?.max || 0)

        const formatNumberSafely = (num: number) => {
            return num < 0.01 && num > 0 ? '0.01' : num.toFixed(2)
        }

        return {
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
        }
    }, [isXChain, txFee, calculatedSlippage, chargeDetails, selectedTokenData])

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
                <InfoRow
                    label="Recipient"
                    value={urlParams?.recipient || chargeDetails?.requestLink?.recipientAddress}
                />

                <InfoRow
                    label="You are paying"
                    value={`${chargeDetails?.tokenAmount} ${selectedTokenData?.symbol || chargeDetails.tokenSymbol} on ${getReadableChainName(selectedChain?.chainId || chargeDetails?.chainId)}`}
                />

                <InfoRow
                    label={`${urlParams?.recipientType === 'USERNAME' ? urlParams?.recipient : printableAddress(urlParams?.recipient || (resolvedAddress as string))} will receive`}
                    value={`${chargeDetails?.tokenAmount} ${chargeDetails?.tokenSymbol} on ${getReadableChainName(chargeDetails.chainId || selectedChainID)}`}
                />

                {attachmentOptions.fileUrl && (
                    <InfoRow
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
                <div className="space-y-1">
                    <FeeDescription
                        loading={isLoading}
                        estimatedFee={feeCalculations.estimatedFee}
                        networkFee={feeCalculations.networkFee.max}
                        maxSlippage={feeCalculations.slippage?.max}
                    />

                    <InfoRow
                        loading={isLoading}
                        iconName="transfer"
                        label="Total Max"
                        value={`$${feeCalculations.totalMax}`}
                        moreInfoText={
                            feeCalculations.slippage
                                ? 'Maximum amount you will pay including requested amount, network fees, and maximum slippage.'
                                : 'Maximum amount you will pay including requested amount and network fees.'
                        }
                    />
                </div>
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking the back
                button on the top left corner.
            </div>

            <div className="flex flex-col gap-2">
                {error && (
                    <div className="space-y-2">
                        <ErrorAlert error={error} />

                        <Button
                            onClick={prepareTransaction}
                            disabled={isLoading}
                            variant="transparent-dark"
                            className="w-full"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">🥜</span>
                                    <span>Retrying...</span>
                                </div>
                            ) : (
                                'Retry'
                            )}
                        </Button>
                    </div>
                )}
                <Button
                    onClick={handlePayment}
                    disabled={!isConnected || isLoading || !!error}
                    shadowSize="4"
                    className="w-full"
                >
                    {getButtonText()}
                </Button>
            </div>
        </div>
    )
}
