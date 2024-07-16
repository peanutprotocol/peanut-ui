'use client'
import AddressInput from '@/components/Global/AddressInput'
import * as _consts from '../Claim.consts'
import { useContext, useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
import * as assets from '@/assets'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import useClaimLink from '../useClaimLink'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import MoreInfo from '@/components/Global/MoreInfo'
import TokenSelectorXChain from '@/components/Global/TokenSelector/TokenSelectorXChain'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import * as _interfaces from '../Claim.interfaces'
import * as _utils from '../Claim.utils'
import { Popover } from '@headlessui/react'
import { PopupButton } from '@typeform/embed-react'
export const InitialClaimLinkView = ({
    onNext,
    claimLinkData,
    setRecipient,
    recipient,
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
    recipientType,
    setRecipientType,
    setOfframpForm,
    offrampForm,
    setLiquidationAddress,
    setPeanutAccount,
    setPeanutUser,

    setOfframpXchainNeeded,
    setOfframpChainAndToken,
}: _consts.IClaimScreenProps) => {
    const [fileType, setFileType] = useState<string>('')
    const [isValidRecipient, setIsValidRecipient] = useState(false)
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
    const { estimatePoints, claimLink } = useClaimLink()
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()

    const handleConnectWallet = async () => {
        if (isConnected && address) {
            setRecipient({ name: undefined, address: '' })
            await new Promise((resolve) => setTimeout(resolve, 100))
            setRecipient({ name: undefined, address: address })
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

        if (recipient.address === '') return

        try {
            setLoadingState('Executing transaction')
            const claimTxHash = await claimLink({
                address: recipient.address ?? '',
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
            address: recipient.address ?? address ?? '',
            chainId: claimLinkData.chainId,
            amountUSD: USDValue,
        })
        setEstimatedPoints(estimatedPoints)
    }

    const handleIbanRecipient = async () => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setLoadingState('Getting deposit details')
            let tokenName = _utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            let chainName = _utils.getBridgeChainName(claimLinkData.chainId)

            if (tokenName && chainName) {
                console.log('offramp without xchain possible')
                setOfframpXchainNeeded(false)
            } else {
                console.log('offramp without xchain not possible')
                const usdcAddressOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
                const optimismChainId = '10'

                let route
                try {
                    route = await fetchRoute(usdcAddressOptimism, optimismChainId)
                } catch (error) {
                    console.log('error', error)
                }

                console.log('route', route)
                if (route === undefined) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }
                setOfframpXchainNeeded(true)

                tokenName = _utils.getBridgeTokenName(optimismChainId, usdcAddressOptimism)
                chainName = _utils.getBridgeChainName(optimismChainId)
            }

            setOfframpChainAndToken({
                chain: chainName ?? '',
                token: tokenName ?? '',
            })

            setLoadingState('Getting KYC status')
            const user = await _utils.fetchUser(recipient.name?.replaceAll(' ', '') ?? '')
            setPeanutUser(user)
            if (user) {
                setOfframpForm({ name: user.full_name, email: user.email, recipient: recipient.name ?? '' })

                const account = user.accounts.find(
                    (account: any) =>
                        account.account_identifier.toLowerCase() === recipient.name?.replaceAll(' ', '').toLowerCase()
                )
                setPeanutAccount(account)
                const allLiquidationAddresses = await _utils.getLiquidationAddresses(user.bridge_customer_id)

                console.log('allLiquidationAddresses', allLiquidationAddresses)

                console.log(chainName, tokenName)

                let liquidationAddressDetails = allLiquidationAddresses.find(
                    (address) =>
                        address.chain === chainName &&
                        address.currency === tokenName &&
                        address.external_account_id === account.bridge_account_id
                )

                if (!liquidationAddressDetails) {
                    liquidationAddressDetails = await _utils.createLiquidationAddress(
                        user.bridge_customer_id ?? '',
                        chainName ?? '',
                        tokenName ?? '',
                        account.bridge_account_id,
                        recipientType === 'iban' ? 'sepa' : 'ach',
                        recipientType === 'iban' ? 'eur' : 'usd'
                    )
                }

                setLiquidationAddress(liquidationAddressDetails)
            } else {
                setOfframpForm({ ...offrampForm, recipient: recipient.name ?? '' })
            }

            onNext()
        } catch (error) {
            console.log('error', error)
        } finally {
            setLoadingState('Idle')
        }
    }

    useEffect(() => {
        if (recipient) {
            _estimatePoints()
        }
    }, [recipient])

    useEffect(() => {
        if (recipient.address) return
        if (isConnected && address) {
            setRecipient({ name: undefined, address })
        } else {
            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)
        }
    }, [address])

    useEffect(() => {
        if (refetchXchainRoute) {
            setIsXchainLoading(true)
            setLoadingState('Fetching route')
            setHasFetchedRoute(true)
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            fetchRoute()
            setRefetchXchainRoute(false)
        }
    }, [claimLinkData, refetchXchainRoute])

    const fetchRoute = async (toToken?: string, toChain?: string) => {
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
                    toChain: toChain ? toChain : selectedChainID.toString(),
                    toToken: toToken ? toToken : selectedTokenAddress,
                    slippage: 1,
                    fromAddress: claimLinkData.senderAddress,

                    toAddress:
                        recipientType === 'us' || recipientType === 'iban'
                            ? '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
                            : recipient.address
                              ? recipient.address
                              : address ?? '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
                })
                setRoutes([...routes, route])
                !toToken && !toChain && setSelectedRoute(route)
                return route
            }
        } catch (error) {
            !toToken && !toChain && setSelectedRoute(undefined)
            console.error('Error fetching route:', error)
            setErrorState({
                showError: true,
                errorMessage: 'No route found for the given token pair.',
            })
            return undefined
        } finally {
            setIsXchainLoading(false)
            setLoadingState('Idle')
        }
    }

    return (
        <>
            <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
                {(attachment.message || attachment.attachmentUrl) && (
                    <>
                        <div
                            className={`flex w-full items-center justify-center gap-2 ${utils.checkifImageType(fileType) ? ' flex-row' : ' flex-col'}`}
                        >
                            {attachment.message && (
                                <label className="max-w-full text-h8">
                                    Ref: <span className="font-normal"> {attachment.message} </span>
                                </label>
                            )}
                            {attachment.attachmentUrl && (
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
                            {claimLinkData.tokenAmount} {claimLinkData.tokenSymbol}
                        </label>
                    )}
                    <TokenSelectorXChain
                        data={mappedData}
                        chainName={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? mappedData.find((chain) => chain.chainId === selectedRoute.route.params.toChain)
                                          ?.name
                                    : mappedData.find((data) => data.chainId === selectedChainID)?.name
                                : consts.supportedPeanutChains.find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.name
                        }
                        tokenSymbol={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? selectedRoute.route.estimate.toToken.symbol
                                    : mappedData
                                          .find((data) => data.chainId === selectedChainID)
                                          ?.tokens?.find((token) =>
                                              utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                          )?.symbol
                                : claimLinkData.tokenSymbol
                        }
                        tokenLogoUrl={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? selectedRoute.route.estimate.toToken.logoURI
                                    : mappedData
                                          .find((data) => data.chainId === selectedChainID)
                                          ?.tokens?.find((token) =>
                                              utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                          )?.logoURI
                                : consts.peanutTokenDetails
                                      .find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.tokens.find((token) =>
                                          utils.compareTokenAddresses(token.address, claimLinkData.tokenAddress)
                                      )?.logoURI
                        }
                        chainLogoUrl={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? crossChainDetails?.find(
                                          (chain) => chain.chainId === selectedRoute.route.params.toChain
                                      )?.chainIconURI
                                    : mappedData.find((data) => data.chainId === selectedChainID)?.icon.url
                                : consts.supportedPeanutChains.find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.icon.url
                        }
                        tokenAmount={
                            hasFetchedRoute
                                ? selectedRoute
                                    ? utils.formatTokenAmount(
                                          utils.formatAmountWithDecimals({
                                              amount: selectedRoute.route.estimate.toAmountMin,
                                              decimals: selectedRoute.route.estimate.toToken.decimals,
                                          }),
                                          4
                                      )
                                    : undefined
                                : claimLinkData.tokenAmount
                        }
                        isLoading={isXchainLoading}
                        routeError={errorState.errorMessage === 'No route found for the given token pair.'}
                        routeFound={selectedRoute ? true : false}
                        onReset={() => {
                            setSelectedRoute(null)
                            setHasFetchedRoute(false)
                            setErrorState({
                                showError: false,
                                errorMessage: '',
                            })
                        }}
                        isStatic={recipientType === 'iban' || recipientType === 'us' ? true : false}
                    />
                </div>
                <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                    <AddressInput
                        className="px-1"
                        placeholder="wallet address / ENS / IBAN / US account number"
                        value={recipient.name ? recipient.name : recipient.address ?? ''}
                        onSubmit={(name: string, address: string) => {
                            setRecipient({ name, address })
                            setInputChanging(false)
                        }}
                        _setIsValidRecipient={(valid: boolean) => {
                            setIsValidRecipient(valid)
                            setInputChanging(false)
                        }}
                        setIsValueChanging={() => {
                            setInputChanging(true)
                        }}
                        setRecipientType={(type: interfaces.RecipientType) => {
                            setRecipientType(type)
                        }}
                    />
                    {recipient && isValidRecipient && recipientType !== 'iban' && recipientType !== 'us' && (
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            {selectedRoute && (
                                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'forward'} className="h-4 fill-gray-1" />
                                        <label className="font-bold">Route</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {isXchainLoading ? (
                                            <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700"></div>
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
                                                            (chain) =>
                                                                chain.chainId === selectedRoute.route.params.toChain
                                                        )?.name
                                                    }
                                                    <MoreInfo
                                                        text={`You are bridging ${claimLinkData.tokenSymbol.toLowerCase()} on ${
                                                            consts.supportedPeanutChains.find(
                                                                (chain) =>
                                                                    chain.chainId ===
                                                                    selectedRoute.route.params.fromChain
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
                                        <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700"></div>
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
                                    {estimatedPoints < 0 ? estimatedPoints : `+${estimatedPoints}`}
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
                            if ((hasFetchedRoute && selectedRoute) || recipient.address !== address) {
                                console.log('recipientType', recipientType)
                                if (recipientType === 'iban' || recipientType === 'us') {
                                    handleIbanRecipient()
                                } else {
                                    onNext()
                                }
                            } else {
                                handleClaimLink()
                            }
                        }}
                        disabled={
                            isLoading ||
                            !isValidRecipient ||
                            isXchainLoading ||
                            inputChanging ||
                            (hasFetchedRoute && !selectedRoute)
                        }
                    >
                        {isLoading || isXchainLoading ? (
                            <div className="flex w-full flex-row items-center justify-center gap-2">
                                <Loading /> {loadingState}
                            </div>
                        ) : (hasFetchedRoute && selectedRoute) || recipient.address !== address ? (
                            'Proceed'
                        ) : (
                            'Claim now'
                        )}
                    </button>
                    {!isValidRecipient && (
                        <div
                            className="wc-disable-mf flex cursor-pointer flex-row items-center justify-center gap-1 self-center text-h7 text-purple-1"
                            onClick={() => {
                                handleConnectWallet()
                            }}
                        >
                            <img src={assets.WALLETCONNECT_LOGO.src} className="h-4 w-4" />
                            <label className="cursor-pointer">
                                {isConnected ? 'Or claim/swap to your connected wallet' : 'Connect or Create wallet'}
                            </label>
                        </div>
                    )}
                    {errorState.showError && (
                        <div className="text-center">
                            {errorState.errorMessage === 'offramp unavailable' ? (
                                <label className="text-h8 font-normal text-red">
                                    You can not claim this token to your bank account, reach out on{' '}
                                    <a href="https://discord.gg/uWFQdJHZ6j" target="_blank" className="underline">
                                        discord
                                    </a>{' '}
                                    for support.
                                </label>
                            ) : (
                                <>
                                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                                    {errorState.errorMessage === 'No route found for the given token pair.' && (
                                        <label className="text-h8 font-normal text-red">
                                            {' '}
                                            Click{' '}
                                            <span
                                                className="cursor-pointer text-h8 font-normal text-red underline"
                                                onClick={() => {
                                                    setSelectedRoute(null)
                                                    setHasFetchedRoute(false)
                                                    setErrorState({
                                                        showError: false,
                                                        errorMessage: '',
                                                    })
                                                }}
                                            >
                                                here
                                            </span>
                                            to reset.
                                        </label>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>{' '}
            </div>
            <Popover id="HEpPuXFz" />
        </>
    )
}

export default InitialClaimLinkView
