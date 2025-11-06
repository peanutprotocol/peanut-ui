'use client'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { fetchTokenDetails, fetchTokenPrice } from '@/app/actions/tokens'
import { Button } from '@/components/0_Bruddle'
import { type StatusType } from '@/components/Global/Badges/StatusBadge'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { type TransactionDetails, REWARD_TOKENS } from '@/components/TransactionDetails/transactionTransformer'
import * as consts from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useWallet } from '@/hooks/wallet/useWallet'
import * as interfaces from '@/interfaces'
import { ESendLinkStatus, getParamsFromLink, sendLinksApi, type ClaimLinkData } from '@/services/sendLinks'
import { getInitialsFromName, getTokenDetails, isStableCoin } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useQuery } from '@tanstack/react-query'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import PageContainer from '../0_Bruddle/PageContainer'
import PeanutLoading from '../Global/PeanutLoading'
import * as _consts from './Claim.consts'
import FlowManager from './Link/FlowManager'
import { type PeanutCrossChainRoute } from '@/services/swap'
import { ClaimedView, ClaimErrorView } from './Generic'
import { twMerge } from 'tailwind-merge'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useSearchParams } from 'next/navigation'
import { useHaptic } from 'use-haptic'

export const Claim = ({}) => {
    const [linkUrl, setLinkUrl] = useState<string>('')
    const [step, setStep] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.claimLinkStateType>(_consts.claimLinkStateType.LOADING)
    const [claimLinkData, setClaimLinkData] = useState<ClaimLinkData | undefined>(undefined)
    const [attachment, setAttachment] = useState<{ message: string | undefined; attachmentUrl: string | undefined }>({
        message: undefined,
        attachmentUrl: undefined,
    })
    const [type, setType] = useState<_consts.ClaimType | undefined>(undefined)
    const [recipient, setRecipient] = useState<{ name: string | undefined; address: string }>({
        name: undefined,
        address: '',
    })
    const [tokenPrice, setTokenPrice] = useState<number>(0)
    const [estimatedPoints, setEstimatedPoints] = useState<number>(0)
    const [selectedRoute, setSelectedRoute] = useState<PeanutCrossChainRoute | undefined>(undefined)
    const [transactionHash, setTransactionHash] = useState<string>()
    const [hasFetchedRoute, setHasFetchedRoute] = useState<boolean>(false)

    const [recipientType, setRecipientType] = useState<interfaces.RecipientType>('address')
    const [offrampForm, setOfframpForm] = useState<consts.IOfframpForm>({
        name: '',
        email: '',
        password: '',
        recipient: '',
    })

    const { setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)
    const { selectedTransaction, openTransactionDetails } = useTransactionDetailsDrawer()

    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [userType, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const { address } = useWallet()
    const { user, isFetchingUser } = useAuth()
    const [isLinkCancelling, setisLinkCancelling] = useState(false)
    const senderId = claimLinkData?.sender?.userId
    const { interactions } = useUserInteractions(senderId ? [senderId] : [])

    const { setFlowStep: setClaimBankFlowStep } = useClaimBankFlow()
    const searchParams = useSearchParams()
    const { triggerHaptic } = useHaptic()
    // TanStack Query for fetching send link with automatic retry
    const {
        data: sendLink,
        isLoading: isSendLinkLoading,
        error: sendLinkError,
        refetch, // Get refetch function for manual retry
        failureCount, // Track retry attempts for better UX
    } = useQuery({
        queryKey: ['sendLink', linkUrl],
        queryFn: () => sendLinksApi.get(linkUrl),
        enabled: !!linkUrl, // Only run when we have a link URL
        retry: 4, // Retry a few times for DB replication lag + blockchain indexing
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential: 1s, 2s, 4s, 8s (total ~15s)
        staleTime: 0, // Don't cache (one-time use per link)
        gcTime: 0, // Garbage collect immediately after use
        // Refetch when window regains focus (helps with "close and reopen" scenario)
        refetchOnWindowFocus: true,
        // Refetch on mount (helps with navigation back scenarios)
        refetchOnMount: true,
    })

    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        if (!claimLinkData) return null

        let status: StatusType
        switch (claimLinkData.status) {
            case ESendLinkStatus.creating:
            case ESendLinkStatus.completed:
                status = 'pending'
                break
            case ESendLinkStatus.CLAIMING:
                status = 'processing'
                break
            case ESendLinkStatus.CLAIMED:
                status = 'completed'
                break
            case ESendLinkStatus.CANCELLED:
                status = 'cancelled'
                break
            case ESendLinkStatus.FAILED:
                status = 'failed'
                break
            default:
                status = 'pending'
                break
        }

        const tokenDetails = getTokenDetails({
            tokenAddress: claimLinkData.tokenAddress as Hash,
            chainId: claimLinkData.chainId,
        })

        const rewardData = REWARD_TOKENS[claimLinkData.tokenAddress.toLowerCase()]

        let details: Partial<TransactionDetails> = {
            id: claimLinkData.pubKey,
            status,
            amount: Number(formatUnits(claimLinkData.amount, tokenDetails?.decimals ?? 6)),
            date: new Date(claimLinkData.createdAt),
            tokenSymbol: tokenDetails?.symbol,
            initials: getInitialsFromName(claimLinkData.claim?.recipient?.username ?? ''),
            memo: claimLinkData.textContent,
            attachmentUrl: claimLinkData.fileUrl,
            cancelledDate: status === 'cancelled' ? new Date(claimLinkData.events[0].timestamp) : undefined,
            extraDataForDrawer: {
                isLinkTransaction: true,
                originalType: EHistoryEntryType.SEND_LINK,
                originalUserRole: EHistoryUserRole.SENDER,
                link: claimLinkData.link,
                rewardData,
            },
            userName:
                claimLinkData.claim?.recipient?.username ?? claimLinkData.claim?.recipientAddress ?? 'Send via Link',
            sourceView: 'history',
            peanutFeeDetails: {
                amountDisplay: '$ 0.00',
            },
            isVerified: claimLinkData.sender?.bridgeKycStatus === 'approved',
            haveSentMoneyToUser: claimLinkData.sender?.userId
                ? interactions[claimLinkData.sender?.userId] || false
                : false,
        }

        return details as TransactionDetails
    }, [claimLinkData, interactions])

    const handleOnNext = () => {
        if (step.idx === _consts.CLAIM_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CLAIM_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))

        if (step.screen === 'SUCCESS') {
            triggerHaptic()
        }
    }
    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.CLAIM_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }
    const handleOnCustom = (screen: _consts.ClaimScreens) => {
        setStep(() => ({
            screen: screen,
            idx: _consts.CLAIM_SCREEN_FLOW.indexOf(screen),
        }))
    }

    const showTransactionReceipt = useMemo(() => {
        if (!selectedTransaction) return false
        // check for showing txn receipt only to the creator after link is claimed
        if (linkState === _consts.claimLinkStateType.ALREADY_CLAIMED) {
            return user?.user.userId === claimLinkData?.sender?.userId
        }
        return true
    }, [selectedTransaction, linkState, user, claimLinkData])

    // Process sendLink data when it arrives (TanStack Query handles retry automatically)
    // This effect processes link validation WITHOUT user-dependent logic
    useEffect(() => {
        if (!sendLink || !linkUrl) return
        if (isFetchingUser) return // Wait for user data to be ready before processing

        const processLink = async () => {
            try {
                const params = getParamsFromLink(linkUrl)
                const password = params.password

                if (!password) {
                    setLinkState(_consts.claimLinkStateType.WRONG_PASSWORD)
                    return
                }

                setAttachment({
                    message: sendLink.textContent,
                    attachmentUrl: sendLink.fileUrl,
                })

                const tokenDetails = await fetchTokenDetails(sendLink.tokenAddress, sendLink.chainId)
                setClaimLinkData({
                    ...sendLink,
                    link: linkUrl,
                    password,
                    tokenSymbol: tokenDetails.symbol,
                    tokenDecimals: tokenDetails.decimals,
                })
                setSelectedChainID(sendLink.chainId)
                setSelectedTokenAddress(sendLink.tokenAddress)
                const keyPair = generateKeysFromString(password)
                const generatedPubKey = keyPair.address

                const depositPubKey = sendLink.pubKey

                if (generatedPubKey !== depositPubKey) {
                    setLinkState(_consts.claimLinkStateType.WRONG_PASSWORD)
                    return
                }

                if (sendLink.status === ESendLinkStatus.CLAIMED || sendLink.status === ESendLinkStatus.CANCELLED) {
                    setLinkState(_consts.claimLinkStateType.ALREADY_CLAIMED)
                    return
                }

                // Fetch token price - isolate failures to prevent hiding valid links
                try {
                    let price = 0
                    if (isStableCoin(tokenDetails.symbol)) {
                        price = 1
                    } else {
                        const tokenPriceDetails = await fetchTokenPrice(
                            sendLink.tokenAddress.toLowerCase(),
                            sendLink.chainId
                        )
                        if (tokenPriceDetails) {
                            price = tokenPriceDetails.price
                        }
                    }
                    if (0 < price) setTokenPrice(price)
                } catch (priceError) {
                    console.warn('[Claim] Token price fetch failed, continuing without price:', priceError)
                    // Link remains claimable even without price display
                }

                // Set default claim state - will be updated by user-dependent effect below
                setLinkState(_consts.claimLinkStateType.CLAIM)
            } catch (error) {
                console.error('Error processing link:', error)
                setLinkState(_consts.claimLinkStateType.NOT_FOUND)
                Sentry.captureException(error)
            }
        }

        processLink()
    }, [sendLink, linkUrl, isFetchingUser, setSelectedChainID, setSelectedTokenAddress])

    // Separate effect for user-dependent link state updates
    // This runs after link data is processed and determines the correct claim state
    useEffect(() => {
        if (!claimLinkData || isFetchingUser) return

        // If link is already claimed or cancelled, that state takes precedence
        if (claimLinkData.status === ESendLinkStatus.CLAIMED || claimLinkData.status === ESendLinkStatus.CANCELLED) {
            setLinkState(_consts.claimLinkStateType.ALREADY_CLAIMED)
            return
        }

        // Determine claim state based on user
        if (!user) {
            setLinkState(_consts.claimLinkStateType.CLAIM)
        } else if (user.user.userId === claimLinkData.sender?.userId) {
            setLinkState(_consts.claimLinkStateType.CLAIM_SENDER)
        } else {
            setLinkState(_consts.claimLinkStateType.CLAIM)
        }
    }, [user, isFetchingUser, claimLinkData])

    // Handle sendLink fetch errors with better UX
    useEffect(() => {
        if (sendLinkError) {
            console.error('Failed to load link:', sendLinkError)
            Sentry.captureException(sendLinkError)

            // Don't immediately show NOT_FOUND - give user option to retry
            // Link might have just been created
            if (failureCount >= 4) {
                // After all retries exhausted, show error with retry button
                setLinkState(_consts.claimLinkStateType.NOT_FOUND)
            } else {
                // Still retrying, keep showing loading
                setLinkState(_consts.claimLinkStateType.LOADING)
            }
        }
    }, [sendLinkError, failureCount])

    useEffect(() => {
        if (address) {
            setRecipient({ name: '', address })
        }
    }, [address])

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            setLinkUrl(pageUrl) // TanStack Query will automatically fetch when linkUrl changes
        }
    }, [])

    useEffect(() => {
        if (!transactionForDrawer) return
        if (
            linkState === _consts.claimLinkStateType.CLAIM_SENDER ||
            linkState === _consts.claimLinkStateType.ALREADY_CLAIMED
        ) {
            openTransactionDetails(transactionForDrawer)
        }
    }, [linkState, transactionForDrawer])

    // redirect to bank flow if user is KYC approved and step is bank
    useEffect(() => {
        const stepFromURL = searchParams.get('step')
        if (user?.user.bridgeKycStatus === 'approved' && stepFromURL === 'bank') {
            setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
        }
    }, [user])

    return (
        <PageContainer
            alignItems="center"
            className={twMerge('flex flex-col', !user && !isFetchingUser && 'min-h-[calc(100dvh-110px)]')}
        >
            {linkState === _consts.claimLinkStateType.LOADING && (
                <div className="flex flex-col items-center gap-4 px-4">
                    <PeanutLoading />
                    {isSendLinkLoading && failureCount > 0 && (
                        <p className="text-center text-sm text-gray-600">
                            {failureCount < 3
                                ? 'Loading your link...'
                                : 'This is taking longer than usual. The link might have just been created.'}
                        </p>
                    )}
                    {isSendLinkLoading && failureCount >= 3 && (
                        <p className="text-center text-xs text-gray-500">
                            We're still trying... (attempt {failureCount + 1}/5)
                        </p>
                    )}
                </div>
            )}
            {linkState === _consts.claimLinkStateType.CLAIM && (
                <FlowManager
                    recipientType={recipientType}
                    step={step}
                    props={
                        {
                            onPrev: handleOnPrev,
                            onNext: handleOnNext,
                            onCustom: handleOnCustom,
                            claimLinkData,
                            type,
                            setClaimType: setType,
                            recipient,
                            setRecipient,
                            tokenPrice,
                            setTokenPrice,
                            transactionHash,
                            setTransactionHash,
                            estimatedPoints,
                            setEstimatedPoints,
                            attachment,
                            setAttachment,
                            selectedRoute,
                            setSelectedRoute,
                            hasFetchedRoute,
                            setHasFetchedRoute,
                            recipientType,
                            setRecipientType,
                            offrampForm,
                            setOfframpForm,
                            userType,
                            setUserType,
                            userId,
                            setUserId,
                            initialKYCStep,
                            setInitialKYCStep,
                        } as unknown as _consts.IClaimScreenProps
                    }
                />
            )}
            {linkState === _consts.claimLinkStateType.WRONG_PASSWORD && (
                <ClaimErrorView
                    title="Wrong password!"
                    message="Are you sure you clicked on the right link?"
                    primaryButtonText="Try Again"
                    onPrimaryClick={() => {
                        setLinkState(_consts.claimLinkStateType.LOADING)
                        refetch()
                    }}
                />
            )}
            {linkState === _consts.claimLinkStateType.NOT_FOUND && (
                <ClaimErrorView
                    title="This link seems broken!"
                    message="Are you sure you clicked on the right link? Was this link just created? Try again in a few seconds."
                    primaryButtonText="Retry Loading Link"
                    onPrimaryClick={() => {
                        setLinkState(_consts.claimLinkStateType.LOADING)
                        refetch()
                    }}
                />
            )}
            {/* Show this state only to guest users and receivers, never to the link creator */}
            {linkState === _consts.claimLinkStateType.ALREADY_CLAIMED &&
                selectedTransaction &&
                claimLinkData &&
                (!user || user.user.userId !== claimLinkData?.sender?.userId) && (
                    <ClaimedView amount={selectedTransaction.amount} senderUsername={claimLinkData.sender?.username} />
                )}
            {showTransactionReceipt && (
                <TransactionDetailsReceipt
                    transaction={selectedTransaction}
                    setIsLoading={setisLinkCancelling}
                    isLoading={isLinkCancelling}
                    onClose={() => setLinkUrl(window.location.href)}
                />
            )}
        </PageContainer>
    )
}
