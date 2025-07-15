'use client'

import { Button } from '@/components/0_Bruddle'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import {
    MAX_CASHOUT_LIMIT,
    MIN_CASHOUT_LIMIT,
    optimismChainId,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { ActionType, estimatePoints } from '@/components/utils/utils'
import * as consts from '@/constants'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PINTA_WALLET_CHAIN, PINTA_WALLET_TOKEN } from '@/constants'
import { TRANSACTIONS } from '@/constants/query.consts'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { sendLinksApi } from '@/services/sendLinks'
import {
    areEvmAddressesEqual,
    ErrorHandler,
    fetchWithSentry,
    formatTokenAmount,
    getBridgeChainName,
    getBridgeTokenName,
    saveRedirectUrl,
    printableAddress,
} from '@/utils'
import { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS } from '@/utils/token.utils'
import * as Sentry from '@sentry/nextjs'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { IClaimScreenProps } from '../Claim.consts'
import useClaimLink from '../useClaimLink'
import GuestActionList from '@/components/GuestActions/MethodList'
import { useGuestFlow } from '@/context/GuestFlowContext'
import ActionModal from '@/components/Global/ActionModal'
import { Slider } from '@/components/Slider'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'

export const InitialClaimLinkView = ({
    onNext,
    claimLinkData,
    setRecipient,
    recipient,
    tokenPrice,
    setClaimType,
    setEstimatedPoints,
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
}: IClaimScreenProps) => {
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [isXchainLoading, setIsXchainLoading] = useState<boolean>(false)
    const [routes, setRoutes] = useState<any[]>([])
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false)

    const { claimToExternalWallet, resetGuestFlow, showGuestActionsList } = useGuestFlow()
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const {
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        refetchXchainRoute,
        setRefetchXchainRoute,
        isXChain,
        setIsXChain,
    } = useContext(tokenSelectorContext)
    const { claimLink, claimLinkXchain } = useClaimLink()
    const { isConnected: isPeanutWallet, address, fetchBalance } = useWallet()
    const router = useRouter()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()

    const resetSelectedToken = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [claimLinkData, isPeanutWallet])

    const isPeanutClaimOnlyMode = useMemo(() => {
        return searchParams.get('t') === 'pnt'
    }, [searchParams])

    const isPeanutChain = useMemo(() => {
        return (
            claimLinkData.chainId === PEANUT_WALLET_CHAIN.id.toString() ||
            (areEvmAddressesEqual(claimLinkData.tokenAddress, PINTA_WALLET_TOKEN) &&
                claimLinkData.chainId === PINTA_WALLET_CHAIN.id.toString())
        )
    }, [claimLinkData])

    // set token selector chain/token to peanut wallet chain/token if recipient type is username
    useEffect(() => {
        if (recipientType === 'username') {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
            if (!isPeanutChain) {
                setRefetchXchainRoute(true)
                setIsXChain(true)
            }
        } else {
            setSelectedChainID(claimLinkData.chainId)
            setSelectedTokenAddress(claimLinkData.tokenAddress)
        }
    }, [recipientType, claimLinkData.chainId, isPeanutChain, claimLinkData.tokenAddress])

    const handleClaimLink = useCallback(
        async (bypassModal = false) => {
            if (!isPeanutWallet && !bypassModal) {
                setShowConfirmationModal(true)
                return
            }
            setShowConfirmationModal(false)

            setLoadingState('Loading')
            setErrorState({
                showError: false,
                errorMessage: '',
            })

            if (recipient.address === '') return

            try {
                setLoadingState('Executing transaction')
                if (isPeanutWallet) {
                    await sendLinksApi.claim(user?.user.username ?? address, claimLinkData.link)

                    setClaimType('claim')
                    onCustom('SUCCESS')
                    fetchBalance()
                    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                } else {
                    // Check if cross-chain claiming is needed
                    const needsXChain =
                        selectedChainID !== claimLinkData.chainId ||
                        !areEvmAddressesEqual(selectedTokenAddress, claimLinkData.tokenAddress)

                    let claimTxHash: string
                    if (needsXChain) {
                        claimTxHash = await claimLinkXchain({
                            address: recipient.address,
                            link: claimLinkData.link,
                            destinationChainId: selectedChainID,
                            destinationToken: selectedTokenAddress,
                        })
                        setClaimType('claimxchain')
                    } else {
                        claimTxHash = await claimLink({
                            address: recipient.address,
                            link: claimLinkData.link,
                        })
                        setClaimType('claim')
                    }

                    setTransactionHash(claimTxHash)
                    onCustom('SUCCESS')
                    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                }
            } catch (error) {
                const errorString = ErrorHandler(error)
                setErrorState({
                    showError: true,
                    errorMessage: errorString,
                })
                Sentry.captureException(error)
            } finally {
                setLoadingState('Idle')
            }
        },
        [
            claimLinkData.link,
            claimLinkData.chainId,
            claimLinkData.tokenAddress,
            isPeanutWallet,
            fetchBalance,
            recipient.address,
            user,
            claimLink,
            claimLinkXchain,
            selectedChainID,
            selectedTokenAddress,
            onCustom,
            setLoadingState,
            setClaimType,
            setTransactionHash,
            queryClient,
        ]
    )

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
                const cashoutUSDAmount =
                    Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
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
                const userIdResponse = await fetchWithSentry('/api/peanut/user/get-user-id', {
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
                    name: user?.user?.fullName ?? '',
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
                    if (!user?.user.email || !user?.user.fullName) {
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
            Sentry.captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    useEffect(() => {
        let isMounted = true
        if (recipient?.address && isValidRecipient) {
            const amountUSD = Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * (tokenPrice ?? 0)
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
    }, [recipient.address, isValidRecipient, claimLinkData.amount, claimLinkData.chainId, tokenPrice])

    useEffect(() => {
        setIsValidRecipient(!!recipient.address)
    }, [recipient.address])

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

    const isReward = useMemo(() => {
        if (!claimLinkData.tokenAddress) return false
        return areEvmAddressesEqual(claimLinkData.tokenAddress, consts.PINTA_WALLET_TOKEN)
    }, [claimLinkData.tokenAddress])

    const fetchRoute = useCallback(
        async (toToken?: string, toChain?: string) => {
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

                const tokenAmount = claimLinkData.amount

                const fromToken =
                    claimLinkData.tokenAddress === NATIVE_TOKEN_ADDRESS
                        ? SQUID_ETH_ADDRESS
                        : claimLinkData.tokenAddress.toLowerCase()

                const route = await getSquidRouteRaw({
                    squidRouterUrl: `${consts.SQUID_API_URL}/route`,
                    fromChain: claimLinkData.chainId.toString(),
                    fromToken: fromToken,
                    fromAmount: tokenAmount.toString(),
                    toChain: toChain ? toChain : selectedChainID.toString(),
                    toToken: toToken ? toToken : selectedTokenAddress,
                    slippage: 1,
                    fromAddress: claimLinkData.sender?.accounts[0].identifier ?? claimLinkData.senderAddress,
                    toAddress:
                        recipientType === 'us' || recipientType === 'iban'
                            ? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'
                            : recipient.address || '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
                })

                setRoutes([...routes, route])
                if (!toToken && !toChain) {
                    setSelectedRoute(route)
                    setHasFetchedRoute(true)
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
                Sentry.captureException(error)
                return undefined
            } finally {
                setIsXchainLoading(false)
                setLoadingState('Idle')
            }
        },
        [
            claimLinkData,
            isXChain,
            selectedChainID,
            selectedTokenAddress,
            setLoadingState,
            recipient,
            recipientType,
            routes,
        ]
    )

    useEffect(() => {
        let isMounted = true
        if (isReward || !claimLinkData.tokenAddress) {
            return () => {
                isMounted = false
            }
        }

        if (refetchXchainRoute && recipient.address) {
            setIsXchainLoading(true)
            setLoadingState('Fetching route')
            setErrorState({
                showError: false,
                errorMessage: '',
            })

            fetchRoute().finally(() => {
                if (isMounted) {
                    setRefetchXchainRoute(false)
                }
            })
        }
        return () => {
            isMounted = false
        }
    }, [claimLinkData.tokenAddress, refetchXchainRoute, isReward, fetchRoute, recipient.address])

    useEffect(() => {
        if ((recipientType === 'iban' || recipientType === 'us') && selectedRoute) {
            return
        }
        setSelectedRoute(undefined)
        setHasFetchedRoute(false)
    }, [recipientType])

    useEffect(() => {
        setSelectedRoute(null)
        setHasFetchedRoute(false)

        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
            if (!isPeanutChain) {
                setRefetchXchainRoute(true)
                setIsXChain(true)
            }
        }

        if (address && !recipient.address) {
            setRecipient({ name: undefined, address })
        }
    }, [isPeanutWallet, address, isPeanutChain])

    // handle xchain claim states
    useEffect(() => {
        if (selectedChainID && selectedTokenAddress) {
            const isXChainTransfer =
                selectedChainID !== claimLinkData.chainId ||
                !areEvmAddressesEqual(selectedTokenAddress, claimLinkData.tokenAddress)

            setIsXChain(isXChainTransfer)

            // if selectedRoute or cross-chain transfer with valid addresses is present
            if (selectedRoute || (isXChainTransfer && recipient.address && isValidRecipient)) {
                setHasFetchedRoute(true)
                // if no route yet, fetch it
                if (!selectedRoute) {
                    setRefetchXchainRoute(true)
                }
            } else if (isXChainTransfer && !hasFetchedRoute) {
                setRefetchXchainRoute(true)
            }
        }
    }, [
        selectedChainID,
        selectedTokenAddress,
        claimLinkData.chainId,
        claimLinkData.tokenAddress,
        selectedRoute,
        recipient.address,
        isValidRecipient,
    ])

    const getButtonText = () => {
        if (isPeanutWallet && !isPeanutChain) {
            return 'Review'
        }
        if ((selectedRoute || (isXChain && hasFetchedRoute)) && !isPeanutChain) {
            return 'Review'
        }

        if (isLoading) {
            return 'Claiming'
        }

        return 'Receive'
    }

    const handleClaimAction = () => {
        if (isPeanutWallet && !isPeanutChain) {
            setRefetchXchainRoute(true)
            onNext()
        } else if (recipientType === 'iban' || recipientType === 'us') {
            handleIbanRecipient()
        } else if ((selectedRoute || (isXChain && hasFetchedRoute)) && !isPeanutChain) {
            onNext()
        } else {
            handleClaimLink()
        }
    }

    const guestAction = () => {
        if (!!user?.user.userId || claimToExternalWallet) return null
        return (
            <div className="space-y-4">
                {!showGuestActionsList && (
                    <Button
                        shadowSize="4"
                        onClick={() => {
                            saveRedirectUrl()
                            router.push('/setup')
                        }}
                        className="flex w-full items-center gap-1"
                    >
                        <div>Continue with </div>
                        <div className="flex items-center gap-1">
                            <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                            <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                        </div>
                    </Button>
                )}
                {!isPeanutClaimOnlyMode && <GuestActionList />}
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            {!!user?.user.userId || showGuestActionsList ? (
                <div className="md:hidden">
                    <NavHeader
                        title="Receive"
                        onPrev={() => {
                            if (showGuestActionsList) {
                                resetGuestFlow()
                            } else {
                                router.push('/home')
                            }
                        }}
                    />
                </div>
            ) : (
                <div className="-mt-1 md:hidden">
                    <div className="pb-1 text-center text-2xl font-extrabold">Receive</div>
                </div>
            )}
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={claimLinkData.sender?.username ?? printableAddress(claimLinkData.senderAddress)}
                    amount={
                        isReward
                            ? formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!
                            : (formatTokenAmount(
                                  Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                              ) ?? '')
                    }
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                    fileUrl={attachment.attachmentUrl}
                />

                {/* Token Selector
                 * We don't want to show this if we're claiming to peanut wallet. Else its okay
                 */}
                {!isPeanutWallet &&
                    recipientType !== 'iban' &&
                    recipientType !== 'us' &&
                    !isPeanutClaimOnlyMode &&
                    !!claimToExternalWallet && (
                        <TokenSelector viewType="claim" disabled={recipientType === 'username'} />
                    )}

                <div className="space-y-2">
                    {/* Alternative options section with divider */}
                    {!isPeanutClaimOnlyMode && (
                        <>
                            {/* Manual Input Section - Always visible in non-peanut-only mode */}
                            {!isPeanutWallet && !!claimToExternalWallet && (
                                <GeneralRecipientInput
                                    placeholder="Enter a username, an address or ENS"
                                    recipient={recipient}
                                    onUpdate={(update: GeneralRecipientUpdate) => {
                                        setRecipient(update.recipient)
                                        if (!update.recipient.address) {
                                            setRecipientType('address')
                                            // Reset loading state when input is cleared
                                            setLoadingState('Idle')
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
                                    showInfoText={false}
                                />
                            )}
                        </>
                    )}
                    {recipientType === 'username' && !!claimToExternalWallet && (
                        <div className="text-xs text-grey-1">
                            You can only claim USDC on Arbitrum for Peanut Wallet users.
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {guestAction()}
                    {(!!claimToExternalWallet || !!user?.user.userId) && (
                        <Button
                            icon={'arrow-down'}
                            shadowSize="4"
                            onClick={handleClaimAction}
                            loading={isLoading || isXchainLoading}
                            disabled={
                                isLoading ||
                                isXchainLoading ||
                                inputChanging ||
                                !isValidRecipient ||
                                (isXChain && !selectedRoute && (!hasFetchedRoute || isXchainLoading))
                            }
                            className="text-sm md:text-base"
                        >
                            {getButtonText()}
                        </Button>
                    )}
                </div>
            </div>
            <ActionModal
                visible={showConfirmationModal}
                onClose={() => setShowConfirmationModal(false)}
                title="Is this address compatible?"
                description={
                    <div className="space-y-2">
                        <p>Only claim to an address that support the selected network and token.</p>
                        <p className="font-bold">Incorrect transfers may be lost.</p>
                    </div>
                }
                icon="alert"
                iconContainerClassName="bg-yellow-400"
                footer={
                    <div className="w-full">
                        <Slider onValueChange={(v) => v && handleClaimLink(true)} />
                    </div>
                }
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
        </div>
    )
}
