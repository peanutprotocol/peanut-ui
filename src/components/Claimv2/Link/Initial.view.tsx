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
            fetch(attachment?.attachmentUrl)
                .then((response) => response.blob())
                .then((blob) => {
                    setFileType(blob.type)
                })
                .catch((error) => {
                    console.error('Error fetching the blob from URL:', error)
                    setFileType('') // Reset or handle the error state
                })
        }
    }, [attachment?.attachmentUrl])

    useEffect(() => {
        if (recipientAddress) {
            _estimatePoints()
        }
    }, [recipientAddress])

    useEffect(() => {
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

    useEffect(() => {
        if (mappedData.length > 0) {
            setSelectedChainID(mappedData[0].chainId)
        }
    }, [])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">You've received</label>
            <ConfirmDetails
                tokenAmount={claimLinkData.tokenAmount}
                tokenPrice={tokenPrice}
                selectedChainID={claimLinkData.chainId}
                selectedTokenAddress={claimLinkData.tokenAddress}
            />
            {(attachment.message || attachment.attachmentUrl) && (
                <>
                    {' '}
                    <div className="flex w-full border-t border-dotted border-black" />
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
            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                {isXchainLoading ? (
                    <div className=" flex h-14 w-full max-w-96 animate-pulse flex-row items-center justify-between border border-n-1 px-4 py-2 dark:border-white">
                        <div className="flex flex-row items-center justify-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-700"></div>
                            <div className="flex flex-col items-start justify-center gap-2">
                                <div className="h-2 w-16 rounded bg-slate-700"></div>
                                <div className="h-2 w-12 rounded bg-slate-700"></div>
                            </div>
                        </div>
                        <div className="flex flex-row items-center justify-center gap-2">
                            <div className="h-2 w-16 rounded bg-slate-700"></div>
                            <div className="h-6 w-6 rounded-full bg-slate-700"></div>
                        </div>
                    </div>
                ) : (
                    <TokenSelectorXChain
                        staticData={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? undefined
                                    : {
                                          tokenAmount: '0',
                                          tokenSymbol:
                                              mappedData
                                                  .find((data) => data.chainId === selectedChainID)
                                                  ?.tokens?.find((token) =>
                                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                                  )?.symbol ?? '',
                                          tokenAddress: selectedTokenAddress,
                                          chainId: selectedChainID,
                                      }
                                : {
                                      tokenAmount: claimLinkData.tokenAmount,
                                      tokenSymbol: claimLinkData.tokenSymbol,
                                      tokenAddress: claimLinkData.tokenAddress,
                                      chainId: claimLinkData.chainId,
                                  }
                        }
                        data={mappedData}
                        xchainTokenAmount={
                            selectedRoute
                                ? utils
                                      .formatAmountWithDecimals({
                                          amount: selectedRoute.route.estimate.toAmountMin * xchainFeeMultiplier,
                                          decimals: selectedRoute.route.estimate.toToken.decimals,
                                      })
                                      .toString()
                                : ''
                        }
                        xchainTokenPrice={selectedRoute ? selectedRoute.route.estimate.toToken.usdPrice : 0}
                        classNameButton={
                            hasFetchedRoute && !selectedRoute ? 'border-n-1 border-red dark:border-red' : ''
                        }
                    />
                )}
                {hasFetchedRoute && !isXchainLoading && (
                    <div
                        className="w-full cursor-pointer text-center text-h9 text-gray-1 underline"
                        onClick={() => {
                            setSelectedRoute(null)
                            setHasFetchedRoute(false)
                            setErrorState({
                                showError: false,
                                errorMessage: '',
                            })
                        }}
                    >
                        Reset to origin chain
                    </div>
                )}
                <AddressInput
                    className="px-1"
                    placeholder="Paste wallet address or ENS name"
                    value={recipientAddress ?? ''}
                    onSubmit={(address: string) => {
                        setRecipientAddress(address)
                    }}
                    _setIsValidAddress={(valid: boolean) => {
                        setIsValidAddress(valid)
                    }}
                />
                {recipientAddress && isValidAddress ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
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
                ) : (
                    <>
                        <div className="flex flex-row items-center justify-center gap-1 text-h9 font-normal">
                            <Icon name={'warning'} />
                            <label>You will lose your funds if you enter a wrong address.</label>
                        </div>

                        <div
                            className="flex cursor-pointer flex-row items-center justify-center gap-1 self-center text-h9 text-purple-1"
                            onClick={() => {
                                handleConnectWallet()
                            }}
                        >
                            <img src={assets.WALLETCONNECT_LOGO.src} className="h-4 w-4" />
                            <label className="cursor-pointer">
                                {isConnected
                                    ? 'Or claim/swap to your connected wallet'
                                    : 'Or connect your wallet to claim or swap.'}
                            </label>
                        </div>
                    </>
                )}
            </div>{' '}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button
                    className="btn-purple btn-xl"
                    onClick={() => {
                        if (hasFetchedRoute && selectedRoute) {
                            onNext()
                        } else {
                            handleClaimLink()
                        }
                    }}
                    disabled={isLoading || !isValidAddress || isXchainLoading || (hasFetchedRoute && !selectedRoute)}
                >
                    {isLoading || isXchainLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : hasFetchedRoute && selectedRoute ? (
                        'Confirm bridge'
                    ) : (
                        'Claim'
                    )}
                </button>
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
