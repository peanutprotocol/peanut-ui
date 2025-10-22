'use client'

import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import {
    MAX_CASHOUT_LIMIT,
    MIN_CASHOUT_LIMIT,
    optimismChainId,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, ROUTE_NOT_FOUND_ERROR } from '@/constants'
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
    printableAddress,
} from '@/utils'
import { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS } from '@/utils/token.utils'
import * as Sentry from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react'
import { formatUnits, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { type IClaimScreenProps } from '../Claim.consts'
import ActionList from '@/components/Common/ActionList'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import useClaimLink from '../useClaimLink'
import ActionModal from '@/components/Global/ActionModal'
import { Slider } from '@/components/Slider'
import { BankFlowManager } from './views/BankFlowManager.view'
import { type PeanutCrossChainRoute, getRoute } from '@/services/swap'
import { Button } from '@/components/0_Bruddle'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { GuestVerificationModal } from '@/components/Global/GuestVerificationModal'
import useKycStatus from '@/hooks/useKycStatus'
import MantecaFlowManager from './MantecaFlowManager'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { invitesApi } from '@/services/invites'
import { EInviteType } from '@/services/services.types'

export const InitialClaimLinkView = (props: IClaimScreenProps) => {
    const {
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
    } = props
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [isXchainLoading, setIsXchainLoading] = useState<boolean>(false)
    const [routes, setRoutes] = useState<PeanutCrossChainRoute[]>([])
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false)

    const {
        claimToExternalWallet,
        flowStep: claimBankFlowStep,
        showVerificationModal,
        setShowVerificationModal,
        setClaimToExternalWallet,
        resetFlow: resetClaimBankFlow,
        claimToMercadoPago,
        setClaimToMercadoPago,
    } = useClaimBankFlow()
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const {
        setSelectedChainID,
        setSelectedTokenAddress,
        selectedTokenData,
        refetchXchainRoute,
        setRefetchXchainRoute,
        isXChain,
        setIsXChain,
    } = useContext(tokenSelectorContext)
    const { claimLink, claimLinkXchain, removeParamStep } = useClaimLink()
    const { isConnected: isPeanutWallet, address, fetchBalance } = useWallet()
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()
    const prevRecipientType = useRef<string | null>(null)
    const prevUser = useRef(user)
    const { isUserBridgeKycApproved } = useKycStatus()

    useEffect(() => {
        if (!prevUser.current && user) {
            resetClaimBankFlow()
        }
        prevUser.current = user
    }, [user, resetClaimBankFlow])

    const resetSelectedToken = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [claimLinkData, isPeanutWallet])

    const isPeanutChain = useMemo(() => {
        return claimLinkData.chainId === PEANUT_WALLET_CHAIN.id.toString()
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
            if (prevRecipientType.current === 'username') {
                setSelectedChainID(claimLinkData.chainId)
                setSelectedTokenAddress(claimLinkData.tokenAddress)
            }
        }
        prevRecipientType.current = recipientType
    }, [recipientType, claimLinkData.chainId, isPeanutChain, claimLinkData.tokenAddress])

    const handleClaimLink = useCallback(
        async (bypassModal = false, autoClaim = false) => {
            if (!selectedTokenData) return
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

            // If the user doesn't have app access, accept the invite before claiming the link
            if (!user?.user.hasAppAccess) {
                try {
                    const inviterUsername = claimLinkData.sender?.username
                    if (!inviterUsername) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Unable to accept invite: missing inviter. Please contact support.',
                        })
                        setLoadingState('Idle')
                        return
                    }
                    const inviteCode = `${inviterUsername}INVITESYOU`
                    const result = await invitesApi.acceptInvite(inviteCode, EInviteType.PAYMENT_LINK)
                    if (!result.success) {
                        console.error('Failed to accept invite')
                        setErrorState({
                            showError: true,
                            errorMessage: 'Something went wrong. Please try again or contact support.',
                        })
                        setLoadingState('Idle')
                        return
                    }

                    // fetch user so that we have the latest state and user can access the app.
                    // We dont need to wait for this, can happen in background.
                    fetchUser()
                } catch (error) {
                    Sentry.captureException(error)
                    console.error('Failed to accept invite', error)
                    setErrorState({
                        showError: true,
                        errorMessage: 'Something went wrong. Please try again or contact support.',
                    })
                    setLoadingState('Idle')
                    return
                }
            }

            try {
                setLoadingState('Executing transaction')

                let recipientAddress: string | undefined
                if (isPeanutWallet) {
                    // Use wallet address from useWallet hook
                    recipientAddress = address
                } else {
                    // Use external wallet address
                    recipientAddress = recipient?.address
                }

                if (!recipientAddress) {
                    throw new Error('No recipient address available')
                }

                // Use secure SDK claim (password stays client-side, only signature sent to backend)
                let claimTxHash: string | undefined
                // Performance optimization: Pass deposit details to skip RPC call on backend
                // Determine contractType: 0 for native ETH, 1 for ERC20 tokens
                // @dev todo: this should be fetched in backend ideally. Might break ETH sendlinks.
                const isNativeToken =
                    claimLinkData.tokenAddress === NATIVE_TOKEN_ADDRESS || claimLinkData.tokenAddress === zeroAddress
                const contractType = isNativeToken ? 0 : 1

                const depositDetails = {
                    pubKey20: claimLinkData.pubKey,
                    amount: claimLinkData.amount.toString(),
                    tokenAddress: claimLinkData.tokenAddress,
                    contractType,
                    claimed: claimLinkData.status === 'CLAIMED' || claimLinkData.status === 'CANCELLED',
                    requiresMFA: false, // MFA not supported in current flow
                    timestamp: Math.floor(new Date(claimLinkData.createdAt).getTime() / 1000),
                    tokenId: '0',
                    senderAddress: claimLinkData.senderAddress,
                }

                // Check if cross-chain claiming is needed
                if (isXChain) {
                    if (!selectedTokenData?.chainId || !selectedTokenData?.address) {
                        throw new Error('Selected token data is required for cross-chain claims')
                    }
                    claimTxHash = await claimLinkXchain({
                        address: recipientAddress,
                        link: claimLinkData.link,
                        destinationChainId: selectedTokenData.chainId,
                        destinationToken: selectedTokenData.address,
                    })
                    setClaimType('claimxchain')
                } else {
                    // Regular P2P claim with optimistic return for faster UX
                    claimTxHash = await claimLink({
                        address: recipientAddress,
                        link: claimLinkData.link,
                        depositDetails, // Performance: Skip RPC call
                        optimisticReturn: true, // UX: Return immediately, poll for txHash
                    })
                    setClaimType('claim')
                }

                // Associate the claim with the user so it shows up in their activity
                if (user && claimTxHash) {
                    try {
                        await sendLinksApi.associateClaim(claimTxHash)
                    } catch (e) {
                        Sentry.captureException(e)
                        console.error('Failed to associate claim', e)
                    }
                }

                setTransactionHash(claimTxHash)
                onCustom('SUCCESS')

                // Refresh balance and transactions for all claim types
                if (isPeanutWallet) {
                    fetchBalance()
                }
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
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
            selectedTokenData,
            onCustom,
            setLoadingState,
            setClaimType,
            setTransactionHash,
            queryClient,
            isXChain,
        ]
    )

    useEffect(() => {
        if (isPeanutWallet && !claimToExternalWallet) resetSelectedToken()
    }, [resetSelectedToken, isPeanutWallet, claimToExternalWallet])

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
                if (isUserBridgeKycApproved) {
                    const account = user.accounts.find(
                        (account) =>
                            account.identifier.replaceAll(/\s/g, '').toLowerCase() ===
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

    // Note: Claimers don't earn points for claiming - only senders earn points for sending.
    // Points will be visible in the sender's transaction history after the claim is processed.
    // The calculatePoints endpoint is meant for senders to preview points before sending.
    useEffect(() => {
        // No points calculation needed on claim screen
    }, [recipient.address, isValidRecipient, claimLinkData.amount, claimLinkData.chainId, tokenPrice, user])

    useEffect(() => {
        setIsValidRecipient(!!recipient.address)
    }, [recipient.address])

    useEffect(() => {
        if (!selectedTokenData) return
        if (
            selectedTokenData.chainId === claimLinkData.chainId &&
            areEvmAddressesEqual(selectedTokenData.address, claimLinkData.tokenAddress)
        ) {
            setIsXChain(false)
            setSelectedRoute(undefined)
            setHasFetchedRoute(false)
        } else {
            setIsXChain(true)
        }
    }, [selectedTokenData, claimLinkData.chainId, claimLinkData.tokenAddress])

    // We may need this when we re add rewards via specific tokens
    // If not, feel free to remove
    const isReward = useMemo(() => {
        return false
    }, [])

    const fetchRoute = useCallback(
        async (toToken?: string, toChain?: string) => {
            if ((!toChain || !toToken) && !selectedTokenData) {
                setIsXchainLoading(false)
                setLoadingState('Idle')
                return
            }
            const chainId = toChain ?? selectedTokenData!.chainId
            const tokenAddress = toToken ?? selectedTokenData!.address
            try {
                const existingRoute = routes.find(
                    (route) =>
                        route.rawResponse.route.estimate.fromToken.chainId === claimLinkData.chainId &&
                        areEvmAddressesEqual(
                            route.rawResponse.route.estimate.fromToken.address,
                            claimLinkData.tokenAddress
                        ) &&
                        route.rawResponse.route.estimate.toToken.chainId === chainId &&
                        areEvmAddressesEqual(route.rawResponse.route.estimate.toToken.address, tokenAddress)
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

                const route = await getRoute(
                    {
                        from: {
                            address: (claimLinkData.sender?.accounts?.[0]?.identifier ??
                                claimLinkData.senderAddress) as Address,
                            tokenAddress: fromToken as Address,
                            chainId: claimLinkData.chainId,
                        },
                        to: {
                            address:
                                recipientType === 'us' || recipientType === 'iban'
                                    ? '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C'
                                    : (recipient.address as Address) || '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
                            tokenAddress: tokenAddress as Address,
                            chainId,
                        },
                        fromAmount: tokenAmount,
                    },
                    { disableCoral: true }
                )

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
                    errorMessage: ROUTE_NOT_FOUND_ERROR,
                })
                Sentry.captureException(error)
                return undefined
            } finally {
                setIsXchainLoading(false)
                setLoadingState('Idle')
            }
        },
        [claimLinkData, isXChain, selectedTokenData, setLoadingState, recipient, recipientType, routes]
    )

    useEffect(() => {
        if (claimBankFlowStep) {
            resetSelectedToken()
        }
    }, [claimBankFlowStep, resetSelectedToken])

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
                } else {
                    setErrorState({
                        showError: false,
                        errorMessage: '',
                    })
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
        setSelectedRoute(undefined)
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
        if (selectedTokenData) {
            const isXChainTransfer =
                selectedTokenData.chainId !== claimLinkData.chainId ||
                !areEvmAddressesEqual(selectedTokenData.address, claimLinkData.tokenAddress)

            setIsXChain(isXChainTransfer)

            if (isXChainTransfer) {
                if (selectedRoute) {
                    const routeChainId = selectedRoute.rawResponse.route.params.toChain
                    const routeTokenAddress = selectedRoute.rawResponse.route.estimate.toToken.address
                    if (
                        routeChainId !== selectedTokenData.chainId ||
                        !areEvmAddressesEqual(routeTokenAddress, selectedTokenData.address)
                    ) {
                        setRefetchXchainRoute(true)
                    } else {
                        setRefetchXchainRoute(false)
                        setHasFetchedRoute(true)
                    }
                } else {
                    setHasFetchedRoute(false)
                    setRefetchXchainRoute(true)
                }
            } else {
                setHasFetchedRoute(false)
                setRefetchXchainRoute(false)
            }
        }
    }, [
        selectedTokenData,
        claimLinkData.chainId,
        claimLinkData.tokenAddress,
        selectedRoute,
        recipient.address,
        isValidRecipient,
        hasFetchedRoute,
    ])

    const getButtonText = () => {
        if (isPeanutWallet && !claimToExternalWallet) {
            return (
                <div className="flex items-center gap-1">
                    <div>Receive on </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </div>
            )
        }

        if (selectedRoute || (isXChain && hasFetchedRoute)) {
            return 'Review'
        }

        if (isLoading && !inputChanging) {
            return 'Receiving'
        }

        return 'Receive now'
    }

    const handleClaimAction = () => {
        if (claimToExternalWallet) {
            if (isXChain) {
                setRefetchXchainRoute(true)
            }
            onNext()
        } else if (isPeanutWallet && !isPeanutChain) {
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

    useEffect(() => {
        const stepFromURL = searchParams.get('step')
        if (user && claimLinkData.status !== 'CLAIMED') {
            removeParamStep()
            if (stepFromURL === 'claim' && isPeanutWallet) {
                handleClaimLink(false, true)
            } else if (stepFromURL === 'regional-claim') {
                setClaimToMercadoPago(true)
            }
        }
    }, [user, searchParams, isPeanutWallet])

    if (claimBankFlowStep) {
        return <BankFlowManager {...props} />
    }

    if (claimToMercadoPago) {
        return (
            <MantecaFlowManager
                claimLinkData={claimLinkData}
                attachment={attachment}
                amount={
                    isReward
                        ? formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!
                        : (formatTokenAmount(
                              Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * tokenPrice
                          ) ?? '')
                }
            />
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            {!!user?.user.userId || claimBankFlowStep || claimToExternalWallet ? (
                <div>
                    <NavHeader
                        title="Receive"
                        onPrev={() => {
                            if (claimToExternalWallet) {
                                setClaimToExternalWallet(false)
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
                {errorState.showError && <ErrorAlert description={errorState.errorMessage} />}

                {/* Token Selector
                 * We don't want to show this if we're claiming to peanut wallet. Else its okay
                 */}
                {recipientType !== 'iban' &&
                    recipientType !== 'us' &&
                    claimBankFlowStep !== ClaimBankFlowStep.BankCountryList &&
                    !!claimToExternalWallet && (
                        <TokenSelector viewType="claim" disabled={recipientType === 'username'} />
                    )}

                <div className="space-y-2">
                    {/* Alternative options section with divider */}
                    {/* Manual Input Section - Always visible in non-peanut-only mode */}
                    {!!claimToExternalWallet && (
                        <GeneralRecipientInput
                            placeholder="Enter a username, an address or ENS"
                            recipient={recipient}
                            onUpdate={(update: GeneralRecipientUpdate) => {
                                setRecipient(update.recipient)
                                if (!update.recipient.address) {
                                    setRecipientType('address')
                                    // Reset loading state when input is cleared
                                    setLoadingState('Idle')
                                    setErrorState({
                                        showError: false,
                                        errorMessage: '',
                                    })
                                } else {
                                    setRecipientType(update.type)
                                }
                                setIsValidRecipient(update.isValid)
                                setErrorState({
                                    showError: !update.isChanging && !update.isValid,
                                    errorMessage: update.errorMessage,
                                })
                                setInputChanging(update.isChanging)
                            }}
                            showInfoText={false}
                        />
                    )}
                    {recipientType === 'username' && !!claimToExternalWallet && (
                        <div className="text-xs text-grey-1">
                            You can only claim USDC on Arbitrum for Peanut Wallet users.
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    {!!(claimToExternalWallet || !!user?.user.userId) && (
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
                    {!claimToExternalWallet && (
                        <ActionList
                            flow="claim"
                            claimLinkData={claimLinkData}
                            isLoggedIn={!!user?.user.userId}
                            isInviteLink
                        />
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
                        <p className="font-bold">Incorrect transfers may be lost. If you're unsure, do not proceed.</p>
                    </div>
                }
                icon="alert"
                iconContainerClassName="bg-yellow-400"
                footer={
                    <div className="w-full space-y-3">
                        <Slider
                            onValueChange={(v) => {
                                if (!v) return
                                // for cross-chain claims, advance to the confirm screen first
                                if (isXChain) {
                                    setShowConfirmationModal(false)
                                    onNext()
                                } else {
                                    // direct on-chain claim – initiate immediately
                                    handleClaimLink(true)
                                }
                            }}
                        />
                        <Button
                            variant="transparent"
                            className="h-fit p-0 text-sm underline"
                            onClick={() => {
                                setShowConfirmationModal(false)
                                setClaimToExternalWallet(false)
                            }}
                        >
                            Not sure? Claim to peanut instead
                        </Button>
                    </div>
                }
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
            <GuestVerificationModal
                redirectToVerification
                secondaryCtaLabel="Claim with other method"
                isOpen={showVerificationModal}
                onClose={() => {
                    removeParamStep()
                    setShowVerificationModal(false)
                }}
                description="The sender isn't verified, so please create an account and verify your identity to have the funds deposited to your bank."
            />
        </div>
    )
}
