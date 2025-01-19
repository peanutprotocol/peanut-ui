'use client'

import { Button, Card } from '@/components/0_Bruddle'
import { CrispButton } from '@/components/CrispChat'
import AddressLink from '@/components/Global/AddressLink'
import FlowHeader from '@/components/Global/FlowHeader'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import {
    MAX_CASHOUT_LIMIT,
    MIN_CASHOUT_LIMIT,
    optimismChainId,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { ActionType, estimatePoints } from '@/components/utils/utils'
import * as consts from '@/constants'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { TOOLTIPS } from '@/constants/tooltips'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import {
    areEvmAddressesEqual,
    checkifImageType,
    ErrorHandler,
    formatTokenAmount,
    getBridgeChainName,
    getBridgeTokenName,
    saveClaimedLinkToLocalStorage,
} from '@/utils'
import { getSquidTokenAddress, SQUID_ETH_ADDRESS } from '@/utils/token.utils'
import { Popover } from '@headlessui/react'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useState } from 'react'
import * as _consts from '../Claim.consts'
import useClaimLink from '../useClaimLink'

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

    const { setLoadingState, isLoading } = useContext(context.loadingStateContext)
    const {
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        refetchXchainRoute,
        setRefetchXchainRoute,
        isXChain,
        setIsXChain,
        supportedSquidChainsAndTokens,
    } = useContext(context.tokenSelectorContext)
    const { claimLink } = useClaimLink()
    const { isConnected, address, signInModal, isExternalWallet, isPeanutWallet, selectedWallet, refetchBalances } =
        useWallet()
    const { user } = useAuth()

    const resetSelectedToken = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        } else {
            setSelectedChainID(claimLinkData.chainId)
            setSelectedTokenAddress(claimLinkData.tokenAddress)
        }
    }, [claimLinkData, isPeanutWallet])

    // TODO: all handleConnectWallet will need to pass through useWallet()
    const handleConnectWallet = async () => {
        if (isConnected && address) {
            setRecipient({ name: undefined, address: '' })
            await new Promise((resolve) => setTimeout(resolve, 100))
            setRecipient({ name: undefined, address: address })
        } else {
            signInModal.open()
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

            // TODO: there is a mixup here between recipient.address and address - from
            // the previous component (Claim.tsx) recipient.address is set to {address} = useWallet
            // thought: anyway, we need to set address to useWallet here too

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
                refetchBalances(address ?? '')
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

    useEffect(() => {
        if (isPeanutWallet) resetSelectedToken()
    }, [resetSelectedToken, isPeanutWallet])

    const handleIbanRecipient = async () => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setLoadingState('Fetching route')

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

            let tokenName = getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            let chainName = getBridgeChainName(claimLinkData.chainId)

            if (!tokenName || !chainName) {
                console.log('Debug - Routing through USDC Optimism')
                const fromToken = getSquidTokenAddress(claimLinkData.tokenAddress)

                const route = await fetchRoute(usdcAddressOptimism, optimismChainId)
                if (!route) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }

                tokenName = getBridgeTokenName(optimismChainId, usdcAddressOptimism)
                chainName = getBridgeChainName(optimismChainId)
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
                if (response.isNewUser) {
                    setUserType('NEW')
                } else {
                    setUserType('EXISTING')
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
                if (user?.user.kycStatus === 'approved') {
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
            areEvmAddressesEqual(selectedTokenAddress, claimLinkData.tokenAddress)
        ) {
            setIsXChain(false)
            setSelectedRoute(null)
            setHasFetchedRoute(false)
        } else {
            setIsXChain(true)
        }
    }, [selectedChainID, selectedTokenAddress, claimLinkData.chainId, claimLinkData.tokenAddress])

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
                    route.toChain === (toChain || selectedChainID) &&
                    areEvmAddressesEqual(route.toToken, toToken || selectedTokenAddress)
            )

            if (existingRoute) {
                setSelectedRoute(existingRoute)
                return existingRoute
            } else if (!isXChain && !toToken && !toChain) {
                setHasFetchedRoute(false)
                return undefined
            }

            const tokenAmount = Math.floor(
                Number(claimLinkData.tokenAmount) * Math.pow(10, claimLinkData.tokenDecimals)
            ).toString()

            const fromToken =
                claimLinkData.tokenAddress === '0x0000000000000000000000000000000000000000'
                    ? SQUID_ETH_ADDRESS
                    : claimLinkData.tokenAddress.toLowerCase()

            const route = await getSquidRouteRaw({
                squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
                fromChain: claimLinkData.chainId.toString(),
                fromToken: fromToken,
                fromAmount: tokenAmount,
                toChain: toChain ? toChain : selectedChainID.toString(),
                toToken: toToken ? toToken : selectedTokenAddress,
                slippage: 1,
                fromAddress: claimLinkData.senderAddress,
                toAddress:
                    recipientType === 'us' || recipientType === 'iban'
                        ? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'
                        : recipient.address || '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
            })

            setRoutes([...routes, route])
            if (!toToken && !toChain) {
                setSelectedRoute(route)
            }
            return route
        } catch (error) {
            console.error('Error fetching route:', error)
            if (!toToken && !toChain) {
                setSelectedRoute(undefined)
            }
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
            return
        }
        setSelectedRoute(undefined)
        setHasFetchedRoute(false)
    }, [recipientType])

    useEffect(() => {
        if (!isConnected) {
            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)
            return
        }

        // reset recipient when wallet type changes or when selected wallet changes
        if (selectedWallet) {
            // reset recipient
            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)

            // set it to the current address after a short delay
            // to ensure the ui updates properly
            setTimeout(() => {
                if (address) {
                    setRecipient({ name: undefined, address: address })
                    setIsValidRecipient(true)
                }
            }, 100)
        }
    }, [selectedWallet, isConnected, address])

    useEffect(() => {
        if (recipient.address) return
        if (isConnected && address) {
            setRecipient({ name: undefined, address })
        } else {
            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)
        }
    }, [address])

    return (
        <div>
            <FlowHeader />
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header className="mx-auto">
                    <Card.Title className="text-center">
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <AddressLink address={claimLinkData.senderAddress} /> sent you
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
                    </Card.Title>
                    <Card.Description>
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
                    </Card.Description>
                </Card.Header>
                <Card.Content className="flex flex-col gap-2">
                    {(!isConnected || isExternalWallet) && recipientType !== 'iban' && recipientType !== 'us' && (
                        <TokenSelector
                            shouldBeConnected={false}
                            showOnlySquidSupported
                            onReset={() => {
                                resetSelectedToken()
                            }}
                        />
                    )}
                    {(!isConnected || isExternalWallet) && (
                        <GeneralRecipientInput
                            className="pl-8"
                            placeholder="wallet address / ENS / IBAN / US account number"
                            recipient={recipient}
                            onUpdate={(update: GeneralRecipientUpdate) => {
                                setRecipient(update.recipient)
                                if (!update.recipient.address) {
                                    setRecipientType('address')
                                } else {
                                    setRecipientType(update.type)
                                }
                                setIsValidRecipient(update.isValid)
                                setErrorState({
                                    showError: !update.isValid,
                                    errorMessage: update.errorMessage,
                                })
                                setInputChanging(update.isChanging)
                            }}
                            infoText={TOOLTIPS.CLAIM_RECIPIENT_INFO}
                        />
                    )}
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
                                                        supportedSquidChainsAndTokens[
                                                            selectedRoute.route.params.toChain
                                                        ]?.axelarChainName
                                                    }
                                                    <MoreInfo
                                                        text={`You are bridging ${claimLinkData.tokenSymbol.toLowerCase()} on ${
                                                            consts.supportedPeanutChains.find(
                                                                (chain) =>
                                                                    chain.chainId ===
                                                                    selectedRoute.route.params.fromChain
                                                            )?.name
                                                        } to ${selectedRoute.route.estimate.toToken.symbol.toLowerCase()} on  ${
                                                            supportedSquidChainsAndTokens[
                                                                selectedRoute.route.params.toChain
                                                            ]?.axelarChainName
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
                            {/* TODO: correct points estimation
                        <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Points</label>
                            </div>
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

                            {/* TODO: correct points estimation
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
                                */}
                        </div>
                    )}
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <Button
                            onClick={() => {
                                // TODO: claiming to IBAN is decided to proceed based on recipient.address !== address, so
                                // imperative to ensure address here is fetched by useWallet
                                if (!isConnected && recipient.address.length === 0) {
                                    handleConnectWallet()
                                } else if ((hasFetchedRoute && selectedRoute) || recipient.address !== address) {
                                    if (recipientType === 'iban' || recipientType === 'us') {
                                        handleIbanRecipient()
                                    } else {
                                        onNext()
                                    }
                                } else {
                                    handleClaimLink()
                                }
                            }}
                            loading={isLoading || isXchainLoading}
                            disabled={
                                isLoading ||
                                isXchainLoading ||
                                inputChanging ||
                                (hasFetchedRoute && !selectedRoute) ||
                                (isValidRecipient === false && recipient.address.length > 0)
                            }
                        >
                            {!isConnected && recipient.address.length === 0
                                ? 'Connect Wallet'
                                : (hasFetchedRoute && selectedRoute) || recipient.address !== address
                                  ? 'Proceed'
                                  : 'Claim now'}
                        </Button>
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
                                                    {isPeanutWallet
                                                        ? 'This token cannot be claimed from peanut wallet. You can use an external wallet'
                                                        : errorState.errorMessage}
                                                </label>{' '}
                                                {!isPeanutWallet && (
                                                    <span
                                                        className="cursor-pointer text-h8 font-normal text-red underline"
                                                        onClick={() => {
                                                            setSelectedRoute(null)
                                                            setHasFetchedRoute(false)
                                                            setErrorState({
                                                                showError: false,
                                                                errorMessage: '',
                                                            })
                                                            resetSelectedToken()
                                                        }}
                                                    >
                                                        reset
                                                    </span>
                                                )}
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
                    <Popover id="HEpPuXFz" />
                </Card.Content>
            </Card>
        </div>
    )
}
