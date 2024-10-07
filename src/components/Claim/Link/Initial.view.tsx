'use client'
import GeneralRecipientInput from '@/components/Global/GeneralRecipientInput'
import * as _consts from '../Claim.consts'
import { useContext, useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
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
import * as _interfaces from '../Claim.interfaces'
import * as _utils from '../Claim.utils'
import { Popover } from '@headlessui/react'
import { useAuth } from '@/context/authContext'
import { ActionType } from '@/components/utils/utils'
import { CrispButton } from '@/components/CrispChat'
import {
    MAX_CASHOUT_LIMIT,
    MIN_CASHOUT_LIMIT,
    optimismChainId,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { AppAPI } from '@/services/app-api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { EstimatePointsArgs, PeanutAPI } from '@/services/peanut-api'

export const InitialClaimLinkView = ({
    onNext,
    claimLinkData,
    setRecipient,
    /**
     * NOTE: Root recipient state is hanlding too many responsabilities.
     * - Duplicates server data
     * - User Input
     * - Wallet & Bank Account
     */
    recipient,
    tokenPrice,
    attachment,
    onCustom,
    crossChainDetails,
    recipientType,
    setRecipientType,
    setOfframpForm,
    setUserType,
    setInitialKYCStep,
}: _consts.IClaimScreenProps) => {
    const { isConnected, address } = useAccount()
    const { selectedChainID, selectedTokenAddress, setSelectedChainID, setSelectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )

    const tokenSelectedNeedsRouting =
        selectedChainID !== claimLinkData.chainId ||
        selectedTokenAddress.toLowerCase() !== claimLinkData.tokenAddress.toLowerCase()

    const { data: route, isLoading: refetchingRoute } = useQuery<any>({
        queryKey: ['route-to', { selectedChainID, selectedTokenAddress }, address, recipientType],
        queryFn: async ({ queryKey }) => {
            const { selectedChainID: toChain, selectedTokenAddress: toToken } = queryKey[1] as {
                selectedChainID: string
                selectedTokenAddress: string
            }
            return await new PeanutAPI().getSquidRouteRaw({
                linkDetails: claimLinkData,
                toChain,
                toToken,
                toAddress:
                    recipientType === 'us' || recipientType === 'iban' || recipientType === undefined
                        ? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'
                        : recipient.address
                          ? recipient.address
                          : (address ?? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'),
            })
        },
        initialData: undefined,
        refetchOnMount: false,
        enabled: tokenSelectedNeedsRouting,
    })

    /**
     * NOTE: Points isn't updated based on route/token change
     */
    const { data: estimatedPoints } = useQuery({
        queryKey: [
            'estimate-points',
            {
                address: recipient.address ?? address ?? '',
                chainId: claimLinkData.chainId,
                amountUSD: Number(claimLinkData.tokenAmount) * (tokenPrice ?? 0),
                actionType: ActionType.CLAIM,
            },
        ],
        queryFn: async ({ queryKey }) => {
            console.log('queryKey', queryKey)
            return new PeanutAPI().estimatePoints(queryKey[1] as EstimatePointsArgs)
        },
        initialData: 0,
        enabled: true,
    })

    const { claimLink: claimLinkGasless } = useClaimLink()

    const { mutateAsync: claim, isPending: claiming } = useMutation({
        mutationKey: ['claiming-', claimLinkData],
        mutationFn: ({ address, link }: { address: string; link: string }) => {
            return claimLinkGasless({ address, link })
        },
        onSettled: (claimTxHash) => {
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
                onCustom('SUCCESS')
            }
        },
    })

    const [fileType] = useState<string>('')
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [inputChanging, setInputChanging] = useState<boolean>(false)

    const { setLoadingState } = useContext(context.loadingStateContext)
    const mappedData: _interfaces.CombinedType[] = _utils.mapToIPeanutChainDetailsArray(crossChainDetails)
    const { open } = useWeb3Modal()
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

    const handleIbanRecipient = async () => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            let tokenName = utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            let chainName = utils.getBridgeChainName(claimLinkData.chainId)

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

            if (tokenName && chainName) {
            } else {
                if (!crossChainDetails) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }

                let route
                try {
                    setSelectedChainID(optimismChainId)
                    setSelectedTokenAddress(usdcAddressOptimism)
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
                if (!recipient.name) throw new Error('Recipient name is required')
                const response = await AppAPI.getUserById(recipient.name)

                if (response.isNewUser) {
                    setUserType('NEW')
                } else {
                    setUserType('EXISTING')
                }
                setOfframpForm({
                    name: '',
                    email: '',
                    password: '',
                    recipient: recipient.name ?? '',
                })
                setInitialKYCStep(0)
            } else {
                setOfframpForm({
                    email: user?.user?.email ?? '',
                    name: user?.user?.full_name ?? '',
                    recipient: recipient.name ?? '',
                    password: '',
                })
                if (user?.user.kycStatus === 'verified') {
                    const account = user.accounts.find(
                        (account: any) =>
                            account.account_identifier.toLowerCase() ===
                            recipient.name?.replaceAll(' ', '').toLowerCase()
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

    console.log({ address })

    useEffect(() => {
        /**
         * WIP: Solve Recipient side effect
         */
        console.log({ address })
        if (recipient.address) return
        if (isConnected && address) {
            setRecipient({ name: undefined, address })
        } else {
            console.log('Recipient address is not set')

            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)
        }
    }, [address])

    const hasFetchedRoute = Boolean(route)

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
                </div>
                <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                    <TokenSelectorXChain
                        data={mappedData}
                        chainName={
                            hasFetchedRoute
                                ? route
                                    ? mappedData.find((chain) => chain.chainId === route.route.params.toChain)?.name
                                    : mappedData.find((data) => data.chainId === selectedChainID)?.name
                                : consts.supportedPeanutChains.find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.name
                        }
                        tokenSymbol={
                            hasFetchedRoute
                                ? route
                                    ? route.route.estimate.toToken.symbol
                                    : mappedData
                                          .find((data) => data.chainId === selectedChainID)
                                          ?.tokens?.find((token) =>
                                              utils.areTokenAddressesEqual(token.address, selectedTokenAddress)
                                          )?.symbol
                                : claimLinkData.tokenSymbol
                        }
                        tokenLogoUrl={
                            hasFetchedRoute
                                ? route
                                    ? route.route.estimate.toToken.logoURI
                                    : mappedData
                                          .find((data) => data.chainId === selectedChainID)
                                          ?.tokens?.find((token) =>
                                              utils.areTokenAddressesEqual(token.address, selectedTokenAddress)
                                          )?.logoURI
                                : consts.peanutTokenDetails
                                      .find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.tokens.find((token) =>
                                          utils.areTokenAddressesEqual(token.address, claimLinkData.tokenAddress)
                                      )?.logoURI
                        }
                        chainLogoUrl={
                            hasFetchedRoute
                                ? route
                                    ? crossChainDetails?.find((chain) => chain.chainId === route.route.params.toChain)
                                          ?.chainIconURI
                                    : mappedData.find((data) => data.chainId === selectedChainID)?.icon.url
                                : consts.supportedPeanutChains.find((chain) => chain.chainId === claimLinkData.chainId)
                                      ?.icon.url
                        }
                        tokenAmount={
                            hasFetchedRoute
                                ? route
                                    ? utils.formatTokenAmount(
                                          utils.formatAmountWithDecimals({
                                              amount: route.route.estimate.toAmountMin,
                                              decimals: route.route.estimate.toToken.decimals,
                                          }),
                                          4
                                      )
                                    : undefined
                                : claimLinkData.tokenAmount
                        }
                        isLoading={refetchingRoute}
                        routeError={errorState.errorMessage === 'No route found for the given token pair.'}
                        routeFound={route ? true : false}
                        onReset={() => {
                            setSelectedChainID(claimLinkData.chainId)
                            setSelectedTokenAddress(claimLinkData.tokenAddress)
                            setErrorState({
                                showError: false,
                                errorMessage: '',
                            })
                        }}
                        isStatic={
                            recipientType === 'iban' || recipientType === 'us' || !crossChainDetails ? true : false
                        }
                    />
                    <GeneralRecipientInput
                        className="px-1"
                        placeholder="wallet address / ENS / IBAN / US account number"
                        value={recipient.name ? recipient.name : (recipient.address ?? '')}
                        onSubmit={(name: string, address: string) => {
                            setRecipient({ name, address })
                            setInputChanging(false)
                        }}
                        _setIsValidRecipient={({ isValid, error }: { isValid: boolean; error?: string }) => {
                            setIsValidRecipient(isValid)
                            if (error) {
                                setErrorState({
                                    showError: true,
                                    errorMessage: error,
                                })
                            } else {
                                setErrorState({
                                    showError: false,
                                    errorMessage: '',
                                })
                            }
                            setInputChanging(false)
                        }}
                        setIsValueChanging={() => {
                            setInputChanging(true)
                        }}
                        setRecipientType={(type: interfaces.RecipientType) => {
                            setRecipientType(type)
                        }}
                        onDeleteClick={() => {
                            setRecipientType('address')
                            setRecipient({
                                name: undefined,
                                address: '',
                            })
                            setErrorState({
                                showError: false,
                                errorMessage: '',
                            })
                        }}
                    />
                    {recipient && isValidRecipient && recipientType !== 'iban' && recipientType !== 'us' && (
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            {route && (
                                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'forward'} className="h-4 fill-gray-1" />
                                        <label className="font-bold">Route</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {refetchingRoute ? (
                                            <div className="h-2 w-12 animate-colorPulse rounded bg-slate-700"></div>
                                        ) : (
                                            route && (
                                                <>
                                                    {
                                                        consts.supportedPeanutChains.find(
                                                            (chain) => chain.chainId === route.route.params.fromChain
                                                        )?.name
                                                    }
                                                    <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                                                    {
                                                        mappedData.find(
                                                            (chain) => chain.chainId === route.route.params.toChain
                                                        )?.name
                                                    }
                                                    <MoreInfo
                                                        text={`You are bridging ${claimLinkData.tokenSymbol.toLowerCase()} on ${
                                                            consts.supportedPeanutChains.find(
                                                                (chain) =>
                                                                    chain.chainId === route.route.params.fromChain
                                                            )?.name
                                                        } to ${route.route.estimate.toToken.symbol.toLowerCase()} on  ${
                                                            mappedData.find(
                                                                (chain) => chain.chainId === route.route.params.toChain
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
                                    {refetchingRoute ? (
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
                            if ((hasFetchedRoute && route) || recipient.address !== address) {
                                if (recipientType === 'iban' || recipientType === 'us') {
                                    handleIbanRecipient()
                                } else {
                                    onNext()
                                }
                            } else {
                                claim({
                                    address: recipient.address ?? '',
                                    link: claimLinkData.link,
                                })
                            }
                        }}
                        disabled={
                            claiming ||
                            !isValidRecipient ||
                            refetchingRoute ||
                            inputChanging ||
                            (hasFetchedRoute && !route) ||
                            recipient.address.length === 0
                        }
                    >
                        {(() => {
                            console.log({
                                claiming,
                                isValidRecipient,
                                refetchingRoute,
                                inputChanging,
                                hasFetchedRoute,
                                route,
                                recipient,
                            })
                            return null
                        })()}
                        {claiming || refetchingRoute ? (
                            <div className="flex w-full flex-row items-center justify-center gap-2">
                                <Loading /> {claiming}
                            </div>
                        ) : (hasFetchedRoute && route) || recipient.address !== address ? (
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
                    {errorState.showError ? (
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
                                            <label className=" text-h8 font-normal text-red ">
                                                {errorState.errorMessage}
                                            </label>{' '}
                                            <span
                                                className="cursor-pointer text-h8 font-normal text-red underline"
                                                onClick={() => {
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
                                        <>
                                            <label className=" text-h8 font-normal text-red ">
                                                You can not claim links with less than ${MIN_CASHOUT_LIMIT} to your bank
                                                account.{' '}
                                            </label>
                                        </>
                                    )}
                                    {errorState.errorMessage === 'offramp_mt_maximum' && (
                                        <>
                                            <label className=" text-h8 font-normal text-red ">
                                                You can not claim links with more than ${MAX_CASHOUT_LIMIT} to your bank
                                                account.{' '}
                                            </label>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        (recipientType === 'iban' || recipientType === 'us') && (
                            <label className="text-h8 font-normal ">
                                Only US and EU accounts are supported currently.{' '}
                                <CrispButton className="mr-1 underline">Reach out</CrispButton>
                                if you would like more info.
                            </label>
                        )
                    )}
                </div>{' '}
            </div>
            <Popover id="HEpPuXFz" />
        </>
    )
}

export default InitialClaimLinkView
