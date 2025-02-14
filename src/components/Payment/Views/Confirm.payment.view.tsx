'use client'

import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { supportedPeanutChains } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ITokenPriceData } from '@/interfaces'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { TRequestChargeResponse } from '@/services/services.types'
import { fetchTokenPrice, isAddressZero, switchNetwork as switchNetworkUtil } from '@/utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useSwitchChain } from 'wagmi'

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const { isConnected, chain: currentChain, address } = useWallet()
    const { attachmentOptions, urlParams, error } = usePaymentStore()
    const { selectedChainID, selectedTokenData } = useContext(tokenSelectorContext)
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
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

    // determine if all params are present in the URL
    const isDirectUrlAccess = useMemo(() => {
        return urlParams && urlParams.recipient && urlParams.amount && urlParams.token && urlParams.chain
    }, [urlParams])

    // Get selected chain details
    const selectedChain = supportedPeanutChains.find((chain) => chain.chainId.toString() === selectedChainID)

    // call charges service to get charge details
    useEffect(() => {
        if (chargeId) {
            chargesApi
                .get(chargeId)
                .then((charge) => {
                    setCharge(charge)
                    dispatch(paymentActions.setChargeDetails(charge))
                })
                .catch((error) => {
                    dispatch(paymentActions.setError(error instanceof Error ? error.message : error.toString()))
                })
        }
    }, [chargeId, dispatch])

    useEffect(() => {
        if (!charge) return

        fetchTokenPrice(charge.tokenAddress.toLowerCase(), charge.chainId).then((tokenPriceData) => {
            if (tokenPriceData) {
                setTokenPriceData(tokenPriceData)
            } else {
                dispatch(paymentActions.setError('Failed to fetch token price'))
            }
        })
    }, [charge, dispatch])

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
        if (!charge || !address) return

        setIsLoading(true)
        dispatch(paymentActions.setError(null))

        try {
            // check if cross-chain transaction is needed
            const isSourceChainDifferent = selectedChainID !== charge.chainId
            setIsXChain(isSourceChainDifferent)

            if (isSourceChainDifferent) {
                // prepare cross-chain tx
                if (!selectedTokenData) {
                    throw new Error('Token data not found')
                }

                console.log('Selected token data:', selectedTokenData)
                console.log('Charge request link:', charge.requestLink)

                const txData = await createXChainUnsignedTx(
                    {
                        address: selectedTokenData.address,
                        chainId: selectedChainID,
                        decimals: selectedTokenData.decimals,
                    },
                    {
                        recipientAddress: charge.requestLink.recipientAddress,
                        chainId: charge.chainId,
                        tokenAmount: charge.tokenAmount,
                        tokenAddress: charge.tokenAddress,
                        tokenDecimals: charge.tokenDecimals,
                        tokenType: charge.tokenType,
                    },
                    address
                )

                if (!txData?.unsignedTxs) {
                    throw new Error('Failed to prepare cross-chain transaction')
                }

                setXChainUnsignedTxs(txData.unsignedTxs)
                setEstimatedFromValue(txData.estimatedFromAmount)
            } else {
                // Prepare same-chain tx
                if (!charge.tokenType || !charge.requestLink?.recipientAddress) {
                    throw new Error('Missing required charge data')
                }

                const tokenType = Number(charge.tokenType)
                const { unsignedTx } = peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: charge.requestLink.recipientAddress,
                    tokenAddress: charge.tokenAddress || '',
                    tokenAmount: charge.tokenAmount || '0',
                    tokenDecimals: charge.tokenDecimals || 18,
                    tokenType: tokenType,
                })

                if (!unsignedTx) {
                    throw new Error('Failed to prepare transaction')
                }

                setUnsignedTx(unsignedTx)
            }
        } catch (error) {
            console.error('Failed to prepare transaction:', error)
            dispatch(paymentActions.setError(error instanceof Error ? error.message : 'Failed to prepare transaction'))
            return false
        } finally {
            setIsLoading(false)
        }
        return true
    }

    // prepare transaction when charge is ready
    useEffect(() => {
        prepareTransaction()
    }, [charge, address, selectedChainID, selectedTokenData])

    // reset error when component mounts
    useEffect(() => {
        dispatch(paymentActions.setError(null))
    }, [dispatch])

    // handle payment
    const handlePayment = async () => {
        if (!isConnected || !address || !charge) return
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
                tokenValue: isXChain ? estimatedFromValue : charge.tokenAmount,
            })

            const targetChainId = isXChain ? selectedChainID : charge.chainId
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
            setTransactionHash(hash ?? '')

            // update payment details in backend
            const response = await fetch(`/api/proxy/charges/${charge.uuid}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chainId: currentChain?.id,
                    hash: hash,
                    tokenAddress: isXChain ? selectedTokenData?.address : charge.tokenAddress,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to record payment')
            }

            const paymentDetails = await response.json()
            dispatch(paymentActions.setPaymentDetails(paymentDetails))
            dispatch(paymentActions.setView('SUCCESS'))
        } catch (error) {
            dispatch(paymentActions.setError(error instanceof Error ? error.message : 'Payment failed'))
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
                    <span>{isXChain ? 'Fetching Best Quote For You...' : 'Preparing Transaction...'}</span>
                </div>
            )
        }
        return 'Confirm Payment'
    }

    if (!charge) return <PeanutLoading />

    // todo: render values from charge data and not url
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
                <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Recipient</div>
                    </div>
                    <div className="font-semibold">{urlParams?.recipient || charge?.requestLink?.recipientAddress}</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">You are paying</div>
                    </div>
                    <div className="font-semibold">
                        {urlParams?.amount || charge?.tokenAmount} {selectedTokenData?.symbol} on{' '}
                        {getReadableChainName(charge?.chainId)}
                    </div>
                </div>

                {/* URL Parameters Section */}
                {/* {urlParams?.chain && ( */}
                <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                    <div className="text-sm font-semibold text-grey-1">{urlParams?.recipient} will receive</div>
                    <div className="font-semibold capitalize">
                        {urlParams?.amount || charge?.tokenAmount} {urlParams?.token || selectedTokenData?.symbol} on{' '}
                        {urlParams?.chain
                            ? getReadableChainName(urlParams.chain)
                            : getReadableChainName(selectedChainID)}
                    </div>
                </div>
                {/* // )} */}

                {/* {urlParams?.token && (
                    <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                        <div className="text-sm font-semibold text-grey-1">Destination Token</div>
                        <div className="font-semibold uppercase">{urlParams.token}</div>
                    </div>
                )} */}

                {/* only show if the user is not accessing the payment directly via URL */}
                {/* {!isDirectUrlAccess && selectedChainID && selectedTokenData && (
                    <>
                        <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                            <div className="text-sm font-semibold text-grey-1">Payment Chain</div>
                            <div className="font-semibold capitalize">{getReadableChainName(selectedChainID)}</div>
                        </div>

                        <div className="flex items-center justify-between border-b border-dashed border-black py-3">
                            <div className="text-sm font-semibold text-grey-1">Payment Token</div>
                            <div className="font-semibold uppercase">{selectedTokenData.symbol}</div>
                        </div>
                    </>
                )} */}

                {attachmentOptions.fileUrl && (
                    <div className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black py-3">
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'paperclip'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Attachment</div>
                            </div>
                            <a
                                href={attachmentOptions.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-start text-sm font-semibold leading-4 hover:underline"
                            >
                                <span>Download </span>
                                <Icon name={'download'} className="h-4 fill-grey-1" />
                            </a>
                        </div>
                    </div>
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
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking the back
                button on the top left corner.
            </div>

            <div className="flex flex-col gap-2">
                {error && (
                    <div className="space-y-2">
                        <div className="border border-red/30 bg-red/10 px-2 py-1">
                            <div className="flex">
                                <div className="flex-shrink-0">⚠️</div>
                                <div className="ml-3 flex items-center justify-start gap-2">
                                    <div className="text-sm font-normal text-red">Error :</div>
                                    <div className="text-sm font-medium text-red">{error}</div>
                                </div>
                            </div>
                        </div>

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
