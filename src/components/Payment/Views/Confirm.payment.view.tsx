'use client'

import { Button } from '@/components/0_Bruddle'
import { useCreateLink } from '@/components/Create/useCreateLink'
import Icon from '@/components/Global/Icon'
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
    const { attachmentOptions, urlParams } = usePaymentStore()
    const { selectedChainID, selectedTokenData } = useContext(tokenSelectorContext)
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [tokenPriceData, setTokenPriceData] = useState<ITokenPriceData | undefined>(undefined)
    const [error, setError] = useState<string>('')
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
                    setError(error.message)
                })
        }
    }, [chargeId, dispatch])

    useEffect(() => {
        if (!charge) return

        fetchTokenPrice(charge.tokenAddress.toLowerCase(), charge.chainId).then((tokenPriceData) => {
            if (tokenPriceData) {
                setTokenPriceData(tokenPriceData)
            } else {
                setError('Failed to fetch token price')
            }
        })
    }, [charge])

    // helper function to prepare cross-chain tx
    const createXChainUnsignedTx = async (tokenData: any, requestLink: any, senderAddress: string) => {
        console.log('Creating cross-chain tx with:', { tokenData, requestLink, senderAddress })

        // ensure required data
        if (!tokenData?.address || !tokenData?.chainId || !tokenData?.decimals) {
            throw new Error('Invalid token data for cross-chain transaction')
        }

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
            provider: await peanut.getDefaultProvider(tokenData.chainId.toString()),
            tokenType: isAddressZero(tokenData.address)
                ? peanutInterfaces.EPeanutLinkType.native
                : peanutInterfaces.EPeanutLinkType.erc20,
            fromTokenDecimals: tokenData.decimals,
            linkDetails,
        })
        return xchainUnsignedTxs
    }

    // prepare transaction when charge is ready
    useEffect(() => {
        if (!charge || !address) return

        const prepareTransaction = async () => {
            try {
                setIsLoading(true)
                console.log('Preparing transaction with charge:', {
                    recipientAddress: charge.requestLink?.recipientAddress,
                    tokenAddress: charge.tokenAddress,
                    tokenAmount: charge.tokenAmount,
                    tokenDecimals: charge.tokenDecimals,
                    tokenType: charge.tokenType,
                })

                // check if its a cross-chain tx
                const isXChainTx = charge.chainId !== selectedChainID

                if (isXChainTx) {
                    setIsXChain(true)
                    if (!selectedTokenData) {
                        throw new Error('Selected token data not available')
                    }

                    // prepare cross-chain tx
                    const txData = await createXChainUnsignedTx(
                        selectedTokenData,
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
                    const { unsignedTxs, estimatedFromAmount } = txData
                    setXChainUnsignedTxs(unsignedTxs)
                    setEstimatedFromValue(estimatedFromAmount)
                } else {
                    // prepare same-chain tx
                    if (!charge.tokenType || !charge.requestLink?.recipientAddress) {
                        throw new Error('Missing required charge data')
                    }

                    const tokenType = Number(charge.tokenType)
                    const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                        recipientAddress: charge.requestLink.recipientAddress,
                        tokenAddress: charge.tokenAddress || '',
                        tokenAmount: charge.tokenAmount || '0',
                        tokenDecimals: charge.tokenDecimals || 18,
                        tokenType: tokenType,
                    })

                    if (!tx?.unsignedTx) {
                        throw new Error('Failed to prepare transaction')
                    }

                    setUnsignedTx(tx.unsignedTx)
                }
            } catch (error) {
                console.error('Failed to prepare transaction:', error)
                setError(error instanceof Error ? error.message : 'Failed to prepare transaction')
            } finally {
                setIsLoading(false)
            }
        }

        prepareTransaction()
    }, [charge, address, selectedChainID, selectedTokenData])

    // handle payment
    const handlePayment = async () => {
        if (!isConnected || !address || !charge) return
        if (isXChain && !xChainUnsignedTxs) {
            setError('Cross-chain transaction not ready')
            return
        }
        if (!isXChain && !unsignedTx) {
            setError('Transaction not ready')
            return
        }

        setIsLoading(true)
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
            setError((error as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    // todo: add better loading state
    if (!charge) return <div>Loading...</div>

    return (
        <div className="space-y-4">
            <div className="pb-1 text-start text-h4 font-bold">Confirm Details</div>
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Recipient</div>
                    </div>
                    <div className="font-semibold">{urlParams?.recipient || charge?.requestLink?.recipientAddress}</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Amount</div>
                    </div>
                    <div className="font-semibold">{urlParams?.amount || charge?.tokenAmount}</div>
                </div>

                {/* URL Parameters Section */}
                {urlParams?.chain && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Destination Chain</div>
                        <div className="font-semibold capitalize">{getReadableChainName(urlParams.chain)}</div>
                    </div>
                )}

                {urlParams?.token && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Destination Token</div>
                        <div className="font-semibold uppercase">{urlParams.token}</div>
                    </div>
                )}

                {/* only show if the user is not accessing the payment directly via URL */}
                {!isDirectUrlAccess && selectedChainID && selectedTokenData && (
                    <>
                        <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                            <div className="text-sm font-semibold text-grey-1">Payment Chain</div>
                            <div className="font-semibold capitalize">{getReadableChainName(selectedChainID)}</div>
                        </div>

                        <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                            <div className="text-sm font-semibold text-grey-1">Payment Token</div>
                            <div className="font-semibold uppercase">{selectedTokenData.symbol}</div>
                        </div>
                    </>
                )}

                {attachmentOptions.fileUrl && (
                    <div className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2">
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
                        className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2"
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
                Please confirm all the details before sending the payment, you can edit the details by clicking on the
                back button on the top left corner.
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={handlePayment} disabled={!isConnected || isLoading} className="w-full">
                    {!isConnected ? 'Connect Wallet' : isLoading ? 'Processing Payment...' : 'Pay Now'}
                </Button>
            </div>

            {error && <div className="text-red-500">{error}</div>}

            {/* todo: add error state */}
        </div>
    )
}
