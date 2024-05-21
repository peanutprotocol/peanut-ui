'use client'
import AddressInput from '@/components/Global/AddressInput'
import * as _consts from '../Claim.consts'
import { useContext, useEffect, useState } from 'react'
import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'
import Icon from '@/components/Global/Icon'
import * as assets from '@/assets'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import useClaimLink from '../useClaimLink'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import * as consts from '@/constants'

import * as utils from '@/utils'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import MoreInfo from '@/components/Global/MoreInfo'
import TokenSelectorXChain from '@/components/Global/TokenSelector/TokenSelectorXChain'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import * as _interfaces from '../Claim.interfaces'
import * as _utils from '../Claim.utils'

export const InitialClaimLinkView = ({
    onNext,
    claimLinkData,
    setRecipientAddress,
    recipientAddress,
    tokenPrice,
    setClaimType,
    setEstimatedPoints,
    estimatedPoints,
    attachment,
    setTransactionHash,
    onCustom,
    crossChainDetails,
    selectedRoute,
    setSelectedRoute,
    hasFetchedRoute,
    setHasFetchedRoute,
}: _consts.IClaimScreenProps) => {
    const [fileType, setFileType] = useState<string>('')
    const [isValidAddress, setIsValidAddress] = useState(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [isXchainLoading, setIsXchainLoading] = useState<boolean>(false)
    const [routes, setRoutes] = useState<any[]>([])
    const [inputChanging, setInputChanging] = useState<boolean>(false)

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { selectedChainID, selectedTokenAddress, setSelectedChainID, refetchXchainRoute, setRefetchXchainRoute } =
        useContext(context.tokenSelectorContext)
    const mappedData: _interfaces.CombinedType[] = _utils.mapToIPeanutChainDetailsArray(crossChainDetails)
    const { estimatePoints, claimLink, xchainFeeMultiplier } = useClaimLink()
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()

    const handleConnectWallet = async () => {
        if (isConnected && address) {
            setRecipientAddress('')
            await new Promise((resolve) => setTimeout(resolve, 100))
            setRecipientAddress(address)
        } else {
            open()
        }
    }

    const handleClaimLink = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        if (recipientAddress === '') return

        try {
            setLoadingState('Executing transaction')
            const claimTxHash = await claimLink({
                address: recipientAddress ?? '',
                link: claimLinkData.link,
            })

            if (claimTxHash) {
                utils.saveClaimedLinkToLocalStorage({
                    address: address ?? '',
                    data: {
                        ...claimLinkData,
                        depositDate: new Date(),
                        USDTokenPrice: tokenPrice,
                        points: estimatedPoints,
                        txHash: claimTxHash,
                        message: attachment.message ? attachment.message : undefined,
                        attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
                    },
                })
                setClaimType('claim')
                setTransactionHash(claimTxHash)
                onCustom('SUCCESS')
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    const _estimatePoints = async () => {
        const USDValue = Number(claimLinkData.tokenAmount) * (tokenPrice ?? 0)
        const estimatedPoints = await estimatePoints({
            address: recipientAddress ?? address ?? '',
            link: claimLinkData.link,
            chainId: claimLinkData.chainId,
            amountUSD: USDValue,
        })
        setEstimatedPoints(estimatedPoints)
    }

    useEffect(() => {
        if (attachment?.attachmentUrl) {
            try {
                console.log('attachmentUrl', attachment?.attachmentUrl)
                fetch(attachment?.attachmentUrl)
                    .then((response) => {
                        console.log(response)
                        return response.blob()
                    })
                    .then((blob) => {
                        setFileType(blob.type)
                    })
                    .catch((error) => {
                        console.log('Error fetching the blob from URL:', error)
                        setFileType('') // Reset or handle the error state
                    })
            } catch (error) {}
        }
    }, [attachment?.attachmentUrl])

    useEffect(() => {
        if (recipientAddress) {
            _estimatePoints()
        }
    }, [recipientAddress])

    useEffect(() => {
        if (recipientAddress) return
        if (isConnected && address) {
            setRecipientAddress(address)
        } else {
            setRecipientAddress('')
            setIsValidAddress(false)
        }
    }, [address])

    useEffect(() => {
        const fetchRoute = async () => {
            setIsXchainLoading(true)
            setLoadingState('Fetching route')
            setHasFetchedRoute(true)
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            try {
                const existingRoute = routes.find(
                    (route) =>
                        route.fromChain === claimLinkData.chainId &&
                        route.fromToken.toLowerCase() === claimLinkData.tokenAddress.toLowerCase() &&
                        route.toChain === selectedChainID &&
                        utils.compareTokenAddresses(route.toToken, selectedTokenAddress)
                )
                if (existingRoute) {
                    setSelectedRoute(existingRoute)
                } else {
                    const tokenAmount = Math.floor(
                        Number(claimLinkData.tokenAmount) * Math.pow(10, claimLinkData.tokenDecimals)
                    ).toString()

                    const route = await getSquidRouteRaw({
                        squidRouterUrl: 'https://v2.api.squidrouter.com/v2/route',
                        fromChain: claimLinkData.chainId.toString(),
                        fromToken: claimLinkData.tokenAddress.toLowerCase(),
                        fromAmount: tokenAmount,
                        toChain: selectedChainID.toString(),
                        toToken: selectedTokenAddress,
                        slippage: 1,
                        fromAddress: claimLinkData.senderAddress,
                        toAddress: recipientAddress ? recipientAddress : address ?? '',
                    })
                    setRoutes([...routes, route])
                    setSelectedRoute(route)
                }
            } catch (error) {
                setSelectedRoute(undefined)
                console.error('Error fetching route:', error)
                setErrorState({
                    showError: true,
                    errorMessage: 'No route found for the given token pair.',
                })
            } finally {
                setIsXchainLoading(false)
                setLoadingState('Idle')
            }
        }

        if (refetchXchainRoute) {
            fetchRoute()
            setRefetchXchainRoute(false)
        }
    }, [claimLinkData, refetchXchainRoute])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            {(attachment.message || attachment.attachmentUrl) && (
                <>
                    <div
                        className={`flex w-full items-center justify-center gap-2 ${utils.checkifImageType(fileType) ? ' flex-row' : ' flex-col'}`}
                    >
                        {attachment.message && <label className="text-h8 ">{attachment.message}</label>}
                        {attachment.attachmentUrl && utils.checkifImageType(fileType) ? (
                            <img src={attachment.attachmentUrl} className="h-18 w-18" alt="attachment" />
                        ) : (
                            <a
                                href={attachment.attachmentUrl}
                                download
                                target="_blank"
                                className="flex w-full cursor-pointer flex-row items-center justify-center gap-1 text-h9 font-normal text-gray-1 underline "
                            >
                                <Icon name={'download'} />
                                Download attachment
                            </a>
                        )}
                    </div>
                    <div className="flex w-full border-t border-dotted border-black" />
                </>
            )}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <label className="text-h4">{utils.shortenAddress(claimLinkData.senderAddress)} sent you</label>
                {tokenPrice ? (
                    <label className="text-h2">
                        $ {utils.formatTokenAmount(Number(claimLinkData.tokenAmount) * tokenPrice)}
                    </label>
                ) : (
                    <label className="text-h2 ">
                        {claimLinkData.tokenAmount} ${claimLinkData.tokenSymbol}
                    </label>
                )}
                {isXchainLoading ? (
                    <div className=" flex h-6 w-full max-w-96 animate-pulse flex-row items-center justify-center gap-1 ">
                        <div className="h-3 w-24 rounded-full bg-slate-700"></div>
                    </div>
                ) : (
                    <div className="flex w-full flex-row items-start justify-center gap-1 text-h7">
                        <div>
                            {hasFetchedRoute ? (
                                selectedRoute ? (
                                    <div>
                                        {utils.formatTokenAmount(
                                            utils.formatAmountWithDecimals({
                                                amount: selectedRoute.route.estimate.toAmountMin,
                                                decimals: selectedRoute.route.estimate.toToken.decimals,
                                            })
                                        )}{' '}
                                        {selectedRoute.route.estimate.toToken.symbol} on{' '}
                                        {
                                            mappedData.find(
                                                (chain) => chain.chainId === selectedRoute.route.params.toChain
                                            )?.name
                                        }
                                    </div>
                                ) : (
                                    <div>
                                        {mappedData
                                            .find((data) => data.chainId === selectedChainID)
                                            ?.tokens?.find((token) =>
                                                utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                            )?.symbol ?? ''}{' '}
                                        on{' '}
                                        {
                                            consts.supportedPeanutChains.find(
                                                (chain) => chain.chainId === selectedChainID
                                            )?.name
                                        }
                                    </div>
                                )
                            ) : (
                                <div>
                                    {utils.formatTokenAmount(Number(claimLinkData.tokenAmount))}{' '}
                                    {claimLinkData.tokenSymbol} on{' '}
                                    {
                                        consts.supportedPeanutChains.find(
                                            (chain) => chain.chainId === claimLinkData.chainId
                                        )?.name
                                    }
                                </div>
                            )}
                        </div>
                        {isValidAddress &&
                            (hasFetchedRoute || selectedRoute ? (
                                <label
                                    className="cursor-pointer font-bold text-purple-1"
                                    onClick={() => {
                                        setSelectedRoute(null)
                                        setHasFetchedRoute(false)
                                        setErrorState({
                                            showError: false,
                                            errorMessage: '',
                                        })
                                    }}
                                >
                                    (reset)
                                </label>
                            ) : (
                                <TokenSelectorXChain data={mappedData} />
                            ))}
                    </div>
                )}
            </div>
            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                <AddressInput
                    className="px-1"
                    placeholder="Paste wallet address or ENS name"
                    value={recipientAddress ?? ''}
                    onSubmit={(address: string) => {
                        setRecipientAddress(address)
                        setInputChanging(false)
                    }}
                    _setIsValidAddress={(valid: boolean) => {
                        setIsValidAddress(valid)
                        setInputChanging(false)
                    }}
                    setIsValueChanging={() => {
                        setInputChanging(true)
                    }}
                />
                {recipientAddress && isValidAddress && (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {selectedRoute && (
                            <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                                <div className="flex w-max flex-row items-center justify-center gap-1">
                                    <Icon name={'forward'} className="h-4 fill-gray-1" />
                                    <label className="font-bold">Route</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {isXchainLoading ? (
                                        <div className="h-2 w-12 animate-pulse rounded bg-slate-700"></div>
                                    ) : (
                                        selectedRoute && (
                                            <>
                                                {
                                                    consts.supportedPeanutChains.find(
                                                        (chain) =>
                                                            chain.chainId === selectedRoute.route.params.fromChain
                                                    )?.name
                                                }
                                                <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                                                {
                                                    mappedData.find(
                                                        (chain) => chain.chainId === selectedRoute.route.params.toChain
                                                    )?.name
                                                }
                                                <MoreInfo
                                                    text={`You are bridging ${claimLinkData.tokenSymbol.toLowerCase()} on ${
                                                        consts.supportedPeanutChains.find(
                                                            (chain) =>
                                                                chain.chainId === selectedRoute.route.params.fromChain
                                                        )?.name
                                                    } to ${selectedRoute.route.estimate.toToken.symbol.toLowerCase()} on  ${
                                                        mappedData.find(
                                                            (chain) =>
                                                                chain.chainId === selectedRoute.route.params.toChain
                                                        )?.name
                                                    }.`}
                                                />
                                            </>
                                        )
                                    )}
                                </span>
                            </div>
                        )}

                        <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'gas'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Fees</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {isXchainLoading ? (
                                    <div className="h-2 w-12 animate-pulse rounded bg-slate-700"></div>
                                ) : selectedRoute ? (
                                    <>
                                        {'$' +
                                            utils.formatTokenAmount(
                                                utils.formatAmountWithDecimals({
                                                    amount: selectedRoute.route.estimate.toAmountMin,
                                                    decimals: selectedRoute.route.estimate.toToken.decimals,
                                                }) *
                                                    selectedRoute.route.estimate.toToken.usdPrice *
                                                    (1 - xchainFeeMultiplier)
                                            )}
                                        <MoreInfo
                                            text={
                                                selectedRoute
                                                    ? `This transaction will cost you $${utils.formatTokenAmount(
                                                          utils.formatAmountWithDecimals({
                                                              amount: selectedRoute.route.estimate.toAmountMin,
                                                              decimals: selectedRoute.route.estimate.toToken.decimals,
                                                          }) *
                                                              selectedRoute.route.estimate.toToken.usdPrice *
                                                              (1 - xchainFeeMultiplier)
                                                      )} in network fees.`
                                                    : 'Something went wrong while calculating the transaction cost.'
                                            }
                                        />
                                    </>
                                ) : (
                                    <>
                                        $0.00 <MoreInfo text={'This transaction is sponsored by peanut! Enjoy!'} />
                                    </>
                                )}
                            </span>
                        </div>

                        <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Points</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                +{estimatedPoints}
                                <MoreInfo
                                    text={
                                        estimatedPoints
                                            ? estimatedPoints > 0
                                                ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                                : 'This transaction will not add any points to your total points balance'
                                            : 'This transaction will not add any points to your total points balance'
                                    }
                                />
                            </span>
                        </div>
                    </div>
                )}
            </div>{' '}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button
                    className="btn-purple btn-xl"
                    onClick={() => {
                        if ((hasFetchedRoute && selectedRoute) || recipientAddress !== address) {
                            onNext()
                        } else {
                            handleClaimLink()
                        }
                    }}
                    disabled={
                        isLoading ||
                        !isValidAddress ||
                        isXchainLoading ||
                        inputChanging ||
                        (hasFetchedRoute && !selectedRoute)
                    }
                >
                    {isLoading || isXchainLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (hasFetchedRoute && selectedRoute) || recipientAddress !== address ? (
                        'Proceed'
                    ) : (
                        'Claim now'
                    )}
                </button>
                {!isValidAddress && (
                    <div
                        className="flex cursor-pointer flex-row items-center justify-center gap-1 self-center text-h7 text-purple-1"
                        onClick={() => {
                            handleConnectWallet()
                        }}
                    >
                        <img src={assets.WALLETCONNECT_LOGO.src} className="h-4 w-4" />
                        <label className="cursor-pointer">
                            {isConnected ? 'Or claim/swap to your connected wallet' : 'Or connect your wallet'}
                        </label>
                    </div>
                )}
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>{' '}
        </div>
    )
}

export default InitialClaimLinkView
