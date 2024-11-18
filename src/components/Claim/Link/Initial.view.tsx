'use client'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import * as _consts from '../Claim.consts'
import { useContext, useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import useClaimLink from '../useClaimLink'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import * as consts from '@/constants'
import {
    areTokenAddressesEqual,
    saveClaimedLinkToLocalStorage,
    ErrorHandler,
    getBridgeTokenName,
    getBridgeChainName,
    checkifImageType,
    formatTokenAmount,
} from '@/utils'
import MoreInfo from '@/components/Global/MoreInfo'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import * as _interfaces from '../Claim.interfaces'
import * as _utils from '../Claim.utils'
import { Popover } from '@headlessui/react'
import { useAuth } from '@/context/authContext'
import { ActionType, estimatePoints } from '@/components/utils/utils'
import { CrispButton } from '@/components/CrispChat'
import {
    MAX_CASHOUT_LIMIT,
    MIN_CASHOUT_LIMIT,
    optimismChainId,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { TOOLTIPS } from '@/constants/tooltips'
import AddressLink from '@/components/Global/AddressLink'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'

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
    setUserType,
    setInitialKYCStep,
}: _consts.IClaimScreenProps) => {
    const [fileType] = useState<string>('')
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [isXchainLoading, setIsXchainLoading] = useState<boolean>(false)
    const [routes, setRoutes] = useState<any[]>([])
    const [inputChanging, setInputChanging] = useState<boolean>(false)

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const {
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        refetchXchainRoute,
        setRefetchXchainRoute,
        isXChain,
        setIsXChain,
    } = useContext(context.tokenSelectorContext)
    const mappedData: _interfaces.CombinedType[] = _utils.mapToIPeanutChainDetailsArray(crossChainDetails)
    const { claimLink } = useClaimLink()
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()
    const { user } = useAuth()

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
                saveClaimedLinkToLocalStorage({
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
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleIbanRecipient = async () => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setLoadingState('Fetching route')
            let tokenName = getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            let chainName = getBridgeChainName(claimLinkData.chainId)

            if (tokenPrice) {
                const cashoutUSDAmount = Number(claimLinkData.tokenAmount) * tokenPrice
                if (cashoutUSDAmount < MIN_CASHOUT_LIMIT) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp_lt_minimum',
                    })
                    return
                } else if (cashoutUSDAmount > MAX_CASHOUT_LIMIT) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp_mt_maximum',
                    })
                }
            }

            if (!tokenName || !chainName) {
                if (!crossChainDetails) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }

                let route
                try {
                    route = await fetchRoute(usdcAddressOptimism, optimismChainId)
                } catch (error) {
                    console.log('error', error)
                }

                if (route === undefined) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }
            }

            setLoadingState('Getting KYC status')

            if (!user) {
                console.log(`user not logged in, getting account status for ${recipient.address}`)
                const userIdResponse = await fetch('/api/peanut/user/get-user-id', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accountIdentifier: recipient.address,
                    }),
                })
                const response = await userIdResponse.json()
                console.log('response', response)
                if (response.isNewUser || (response.error && response.error === 'User not found for given IBAN')) {
                    setUserType('NEW')
                    console.log('New user!')
                } else {
                    setUserType('EXISTING')
                    console.log('Existing user!')
                }
                setOfframpForm({
                    name: '',
                    email: '',
                    password: '',
                    recipient: recipient.name ?? recipient.address,
                })
                setInitialKYCStep(0)
            } else {
                setOfframpForm({
                    email: user?.user?.email ?? '',
                    name: user?.user?.full_name ?? '',
                    recipient: recipient.name ?? recipient.address,
                    password: '',
                })
                if (user?.user.kycStatus === 'verified') {
                    const account = user.accounts.find(
                        (account: any) =>
                            account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                            recipient.address.replaceAll(/\s/g, '').toLowerCase()
                    )

                    if (account) {
                        setInitialKYCStep(4)
                    } else {
                        setInitialKYCStep(3)
                    }
                } else {
                    if (!user?.user.email || !user?.user.full_name) {
                        setInitialKYCStep(0)
                    } else {
                        setInitialKYCStep(1)
                    }
                }
            }

            onNext()
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'You can not claim this link to your bank account.',
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    useEffect(() => {
        let isMounted = true
        if (recipient?.address && isValidRecipient) {
            const amountUSD = Number(claimLinkData.tokenAmount) * (tokenPrice ?? 0)
            estimatePoints({
                address: recipient.address,
                chainId: claimLinkData.chainId,
                amountUSD,
                actionType: ActionType.CLAIM,
            }).then((points) => {
                if (isMounted) {
                    setEstimatedPoints(points)
                }
            })
        }
        return () => {
            isMounted = false
        }
    }, [recipient.address, isValidRecipient, claimLinkData.tokenAmount, claimLinkData.chainId, tokenPrice])

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
        if (
            selectedChainID === claimLinkData.chainId &&
            areTokenAddressesEqual(selectedTokenAddress, claimLinkData.tokenAddress)
        ) {
            setIsXChain(false)
            setSelectedRoute(null)
            setHasFetchedRoute(false)
        } else {
            setIsXChain(true)
        }
    }, [selectedChainID, selectedTokenAddress, claimLinkData])

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
                    areTokenAddressesEqual(route.toToken, selectedTokenAddress)
            )
            if (existingRoute) {
                setSelectedRoute(existingRoute)
            } else if (!isXChain) {
                setHasFetchedRoute(false)
            } else {
                const tokenAmount = Math.floor(
                    Number(claimLinkData.tokenAmount) * Math.pow(10, claimLinkData.tokenDecimals)
                ).toString()

                // TODO: this is duplicate with src/utils/fetchRouteRaw
                const route = await getSquidRouteRaw({
                    squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
                    fromChain: claimLinkData.chainId.toString(),
                    fromToken: claimLinkData.tokenAddress.toLowerCase(),
                    fromAmount: tokenAmount,
                    toChain: toChain ? toChain : selectedChainID.toString(),
                    toToken: toToken ? toToken : selectedTokenAddress,
                    slippage: 1,
                    fromAddress: claimLinkData.senderAddress,

                    toAddress:
                        recipientType === 'us' || recipientType === 'iban' || recipientType === undefined
                            ? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'
                            : recipient.address
                              ? recipient.address
                              : (address ?? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'),
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

    useEffect(() => {
        if ((recipientType === 'iban' || recipientType === 'us') && selectedRoute) {
            setSelectedRoute(undefined)
            setHasFetchedRoute(false)
        }
    }, [recipientType])

    return (
        <>
            <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
                {(attachment.message || attachment.attachmentUrl) && (
                    <>
                        <div
                            className={`flex w-full items-center justify-center gap-2 ${checkifImageType(fileType) ? ' flex-row' : ' flex-col'}`}
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
                    <label className="text-h4">
                        <AddressLink address={claimLinkData.senderAddress} /> sent you
                    </label>
                    {tokenPrice ? (
                        <label className="text-h2">
                            $ {formatTokenAmount(Number(claimLinkData.tokenAmount) * tokenPrice)}
                        </label>
                    ) : (
                        <label className="text-h2 ">
                            {claimLinkData.tokenAmount} {claimLinkData.tokenSymbol}
                        </label>
                    )}
                </div>
                <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                    {recipientType !== 'iban' && recipientType !== 'us' && (
                        <TokenSelector
                            shouldBeConnected={false}
                            onReset={() => {
                                setSelectedChainID(claimLinkData.chainId)
                                setSelectedTokenAddress(claimLinkData.tokenAddress)
                            }}
                        />
                    )}
                    <GeneralRecipientInput
                        className=""
                        placeholder="wallet address / ENS / IBAN / US account number"
                        recipient={recipient}
                        onUpdate={(update: GeneralRecipientUpdate) => {
                            setRecipient(update.recipient)
                            setRecipientType(update.type)
                            setIsValidRecipient(update.isValid)
                            setErrorState({
                                showError: !update.isValid,
                                errorMessage: update.errorMessage,
                            })
                            setInputChanging(update.isChanging)
                        }}
                        infoText={TOOLTIPS.CLAIM_RECIPIENT_INFO}
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
                <div className="flex w-full flex-col items-center justify-center gap-4">
                    <button
                        className="btn-purple btn-xl"
                        onClick={() => {
                            if ((hasFetchedRoute && selectedRoute) || recipient.address !== address) {
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
                            (hasFetchedRoute && !selectedRoute) ||
                            recipient.address.length === 0
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
                    {address && recipient.address.length < 0 && recipientType === 'address' && (
                        <div
                            className="wc-disable-mf flex cursor-pointer flex-row items-center justify-center  self-center text-h7"
                            onClick={() => {
                                handleConnectWallet()
                            }}
                        >
                            {isConnected ? 'Or claim/swap to your connected wallet' : 'Connect a wallet'}
                        </div>
                    )}
                    {errorState.showError && (
                        <div className="text-center">
                            {errorState.errorMessage === 'offramp unavailable' ? (
                                <label className="text-h8 font-normal text-red">
                                    You can not claim this token to your bank account.{' '}
                                    <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                                </label>
                            ) : (
                                <>
                                    {errorState.errorMessage === 'No route found for the given token pair.' && (
                                        <>
                                            <label className="text-h8 font-normal text-red">
                                                {errorState.errorMessage}
                                            </label>{' '}
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
                                                reset
                                            </span>
                                        </>
                                    )}
                                    {errorState.errorMessage === 'offramp_lt_minimum' && (
                                        <label className="text-h8 font-normal text-red">
                                            You can not claim links with less than ${MIN_CASHOUT_LIMIT} to your bank
                                            account.
                                        </label>
                                    )}
                                    {errorState.errorMessage === 'offramp_mt_maximum' && (
                                        <label className="text-h8 font-normal text-red">
                                            You can not claim links with more than ${MAX_CASHOUT_LIMIT} to your bank
                                            account.
                                        </label>
                                    )}
                                    {![
                                        'offramp_lt_minimum',
                                        'offramp_mt_maximum',
                                        'No route found for the given token pair.',
                                    ].includes(errorState.errorMessage) && (
                                        <label className="text-h8 font-normal text-red">
                                            {errorState.errorMessage}
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
