import TokenSelector from '@/components/Global/TokenSelector'
import * as consts from '@/constants'
import * as _consts from '../Claim.consts'
import * as _interfaces from '../Claim.interfaces'
import * as _utils from '../Claim.utils'
import * as context from '@/context'
import * as utils from '@/utils'
import { AdvancedTokenSelectorButton } from '@/components/Global/TokenSelector/AdvancedButton'
import { getSquidRouteRaw, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'
import useClaimLink from '../useClaimLink'
import Loading from '@/components/Global/Loading'

export const SwapInitialClaimLinkView = ({
    onNext,
    onPrev,
    claimLinkData,
    tokenPrice,
    crossChainDetails,
    setTransactionHash,
    setClaimType,
}: _consts.IClaimScreenProps) => {
    const { selectedChainID, selectedTokenAddress, setSelectedChainID, refetchXchainRoute, setRefetchXchainRoute } =
        useContext(context.tokenSelectorContext)
    const { xchainFeeMultiplier, claimLinkXchain } = useClaimLink()
    const [isXchainLoading, setIsXchainLoading] = useState<boolean>(false)
    const [routes, setRoutes] = useState<any[]>([]) // Save fetched routes
    const [selectedRoute, setSelectedRoute] = useState<any>(null) // Currently selected route
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { address } = useAccount()

    const sourceToken = consts.peanutTokenDetails
        .find((detail) => detail.chainId === claimLinkData.chainId)
        ?.tokens.find((token) => token.address === claimLinkData.tokenAddress)
    const sourceChain = consts.supportedPeanutChains.find((detail) => detail.chainId === claimLinkData.chainId)
    const mappedData: _interfaces.CombinedType[] = _utils.mapToIPeanutChainDetailsArray(crossChainDetails)

    useEffect(() => {
        const fetchRoute = async () => {
            setIsXchainLoading(true)
            try {
                const existingRoute = routes.find(
                    (route) =>
                        route.fromChain === claimLinkData.chainId &&
                        route.fromToken === claimLinkData.tokenAddress &&
                        route.toChain === selectedChainID &&
                        route.toToken === selectedTokenAddress
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
                        fromToken: claimLinkData.tokenAddress,
                        fromAmount: tokenAmount,
                        toChain: selectedChainID.toString(),
                        toToken: selectedTokenAddress,
                        slippage: 1,
                        fromAddress: claimLinkData.senderAddress,
                        toAddress: address ?? '',
                    })
                    setRoutes([...routes, route])
                    setSelectedRoute(route)
                }
            } catch (error) {
                setSelectedRoute(undefined)
                console.error('Error fetching route:', error)
            }
            setIsXchainLoading(false)
        }

        if (refetchXchainRoute) {
            fetchRoute()
            setRefetchXchainRoute(false)
        }
    }, [claimLinkData, refetchXchainRoute]) // TODO: move this function to useClaimLink

    const handleOnClaim = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            const claimTxHash = await claimLinkXchain({
                address: address ?? '',
                link: claimLinkData.link,
                destinationChainId: selectedChainID,
                destinationToken: selectedTokenAddress,
            })
            if (claimTxHash) {
                utils.saveClaimedLinkToLocalStorage({
                    address: address ?? '',
                    data: { ...claimLinkData, depositDate: new Date(), USDTokenPrice: tokenPrice },
                })
                setClaimType('wallet_xchain')
                setTransactionHash(claimTxHash)
                onNext()
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

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">You're swapping</label>

            <label className="max-w-96 px-2 text-start text-h8 font-light">
                Choose the destination chain and token. You’ll be able to claim the funds in any token on any chain.
            </label>

            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                <label className="text-h7 font-normal">From</label>
                <AdvancedTokenSelectorButton
                    onClick={() => {}}
                    isVisible={false}
                    tokenLogoUri={sourceToken?.logoURI ?? ''}
                    tokenSymbol={sourceToken?.symbol ?? ''}
                    tokenAmount={claimLinkData.tokenAmount}
                    tokenPrice={tokenPrice}
                    chainIconUri={sourceChain?.icon.url ?? ''}
                    chainName={sourceChain?.name ?? ''}
                    isStatic
                    type="xchain"
                />
            </div>
            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                <label className="text-h7 font-normal">To</label>
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
                    <TokenSelector
                        data={mappedData}
                        type="xchain"
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
                        classNameButton={!selectedRoute ? 'border-n-1 border-red dark:border-red' : ''}
                    />
                )}
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <label className="font-normal">
                        {isXchainLoading ? (
                            <div className="h-2 w-12 animate-pulse rounded bg-slate-700"></div>
                        ) : selectedRoute ? (
                            '$' +
                            utils.formatTokenAmount(
                                utils.formatAmountWithDecimals({
                                    amount: selectedRoute.route.estimate.toAmountMin,
                                    decimals: selectedRoute.route.estimate.toToken.decimals,
                                }) *
                                    selectedRoute.route.estimate.toToken.usdPrice *
                                    (1 - xchainFeeMultiplier)
                            )
                        ) : (
                            '$0.00'
                        )}
                    </label>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <label className="font-normal">+300</label>
                </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button
                    className="btn-purple btn-xl"
                    onClick={handleOnClaim}
                    disabled={!selectedRoute || isXchainLoading || isLoading}
                >
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Swap'
                    )}
                </button>
                <button className="btn btn-xl dark:border-white dark:text-white" onClick={onPrev} disabled={isLoading}>
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SwapInitialClaimLinkView
