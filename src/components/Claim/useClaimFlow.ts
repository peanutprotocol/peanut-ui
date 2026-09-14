'use client'
import { generateKeysFromString } from '@/utils/peanut-link.utils'
import { useContext, useEffect, useMemo, useState } from 'react'

import { fetchTokenDetails } from '@/app/actions/tokens'
import { fetchTokenPrice } from '@/services/tokens-price'
import { type StatusType } from '@/components/Global/Badges/StatusBadge'
import { type TransactionDetails, REWARD_TOKENS } from '@/components/TransactionDetails/transactionTransformer'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { useAuth } from '@/context/authContext'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useWallet } from '@/hooks/wallet/useWallet'
import type { RecipientType } from '@/interfaces/interfaces'
import {
    ESendLinkStatus,
    getParamsFromLink,
    resolveClaimLink,
    sendLinksApi,
    type ClaimLinkData,
} from '@/services/sendLinks'
import {
    getInitialsFromName,
    getTokenDetails,
    isStableCoin,
    getChainName,
    getTokenLogo,
    getChainLogo,
} from '@/utils/general.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getUserById } from '@/app/actions/users'
import * as Sentry from '@sentry/nextjs'
import { useQuery } from '@tanstack/react-query'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import * as _consts from './Claim.consts'
import { type ClaimXChainPreview } from './Claim.consts'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useQueryStates, parseAsString } from 'nuqs'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import type { IOfframpForm } from '@/constants/cashout.consts'

// state machine for the claim page — extracted verbatim from Claim.tsx
// (TASK-21854 logic/ui separation). Claim.tsx stays the composition root.
export const useClaimFlow = () => {
    const [linkUrl, setLinkUrl] = useState<string>('')
    const [step, setStep] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.claimLinkStateType>(_consts.claimLinkStateType.LOADING)
    const [claimLinkData, setClaimLinkData] = useState<ClaimLinkData | undefined>(undefined)
    // Provider-blind verified badge: enriched via getUserById once we have the
    // sender's userId. The peanut-sdk doesn't carry isVerified (its sender shape
    // predates the read-model rip-out), so we fetch the live signal from our BE.
    const [senderIsVerified, setSenderIsVerified] = useState<boolean>(false)
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
    const [selectedRoute, setSelectedRoute] = useState<ClaimXChainPreview | undefined>(undefined)
    const [transactionHash, setTransactionHash] = useState<string>()
    const [hasFetchedRoute, setHasFetchedRoute] = useState<boolean>(false)

    const [recipientType, setRecipientType] = useState<RecipientType>('address')
    const [offrampForm, setOfframpForm] = useState<IOfframpForm>({
        name: '',
        email: '',
        password: '',
        recipient: '',
    })

    const { setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)

    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [userType, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const { address } = useWallet()
    const { user, isFetchingUser } = useAuth()
    // current-user KYC gate — capability model (any enabled rail = identity cleared)
    const { isKycApproved } = useCapabilities()
    const [isLinkCancelling, setisLinkCancelling] = useState(false)
    const senderId = claimLinkData?.sender?.userId
    const { interactions } = useUserInteractions(senderId ? [senderId] : [])

    const { setFlowStep: setClaimBankFlowStep } = useClaimBankFlow()
    // url param read via nuqs (DS 10 ratchet) — read-only here, same
    // string-or-null contract as the old searchParams.get('step')
    const [{ step: stepFromURL }] = useQueryStates({ step: parseAsString })
    const { triggerHaptic } = useAppHaptic()
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

        // determine direction based on user role and status
        let direction: TransactionDetails['direction'] = 'send'
        if (status === 'completed') {
            // if link is claimed, show as send from sender's perspective
            direction = 'send'
        }

        // determine recipient name
        const recipientName =
            claimLinkData.claim?.recipient?.username ?? claimLinkData.claim?.recipientAddress ?? 'Send via Link'

        // find the claimed event for timestamp
        const claimedEvent = claimLinkData.events?.find((e) => e.status === 'CLAIMED')
        // the sender's cancel/reclaim stamp; the events fallback only carries a
        // date when a claim attempt was recorded against the link
        const cancelledStamp = claimLinkData.cancelledAt ?? claimLinkData.events?.[0]?.timestamp

        let details: Partial<TransactionDetails> = {
            id: claimLinkData.pubKey,
            direction,
            status,
            amount: Number(formatUnits(claimLinkData.amount, tokenDetails?.decimals ?? 6)),
            date: new Date(claimLinkData.createdAt),
            createdAt: new Date(claimLinkData.createdAt),
            claimedAt: claimedEvent ? new Date(claimedEvent.timestamp) : undefined,
            tokenSymbol: tokenDetails?.symbol,
            tokenAddress: claimLinkData.tokenAddress,
            initials: getInitialsFromName(recipientName),
            memo: claimLinkData.textContent,
            attachmentUrl: claimLinkData.fileUrl,
            cancelledDate: status === 'cancelled' && cancelledStamp ? new Date(cancelledStamp) : undefined,
            txHash: claimLinkData.claim?.txHash,
            extraDataForDrawer: {
                isLinkTransaction: true,
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'SEND_LINK',
                link: claimLinkData.link,
                rewardData,
                transactionCardType: 'send',
            },
            userName: recipientName,
            fullName: claimLinkData.claim?.recipient?.username ?? recipientName,
            sourceView: 'history',
            tokenDisplayDetails: tokenDetails
                ? {
                      tokenSymbol: tokenDetails.symbol,
                      chainName: getChainName(claimLinkData.chainId),
                      tokenIconUrl: getTokenLogo(tokenDetails.symbol),
                      chainIconUrl: getChainName(claimLinkData.chainId)
                          ? getChainLogo(getChainName(claimLinkData.chainId)!)
                          : undefined,
                  }
                : undefined,
            peanutFeeDetails: {
                amountDisplay: '$ 0.00',
            },
            isVerified: senderIsVerified,
            haveSentMoneyToUser: claimLinkData.sender?.userId
                ? interactions[claimLinkData.sender?.userId] || false
                : false,
        }

        return details as TransactionDetails
    }, [claimLinkData, interactions, senderIsVerified])

    // Enrich the sender with a live verified-badge fetch once we have their userId.
    // Falls back to false on error (the badge is a trust signal — not lying is the
    // safest default).
    useEffect(() => {
        const senderUserId = claimLinkData?.sender?.userId
        if (!senderUserId) return
        let cancelled = false
        getUserById(senderUserId)
            .then((u) => {
                if (!cancelled) setSenderIsVerified(u?.isVerified ?? false)
            })
            .catch(() => {
                if (!cancelled) setSenderIsVerified(false)
            })
        return () => {
            cancelled = true
        }
    }, [claimLinkData?.sender?.userId])

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

    // the receipt shown on sender/already-claimed states — pure derivation
    // (used to be pushed into the drawer hook's state via an effect)
    const selectedTransaction = useMemo(() => {
        const isReceiptState =
            linkState === _consts.claimLinkStateType.CLAIM_SENDER ||
            linkState === _consts.claimLinkStateType.ALREADY_CLAIMED
        return isReceiptState ? transactionForDrawer : null
    }, [linkState, transactionForDrawer])

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

                // Treat non-claimable states: CLAIMED, CANCELLED, CLAIMING, and FAILED (if claim tx succeeded)
                // For FAILED: only block if claim tx succeeded (funds left the link to Manteca)
                // If no txHash, the claim tx itself failed and funds are still in the link - user can retry
                const claimTxSucceeded = !!sendLink.claim?.txHash

                if (
                    sendLink.status === ESendLinkStatus.CLAIMED ||
                    sendLink.status === ESendLinkStatus.CANCELLED ||
                    sendLink.status === ESendLinkStatus.CLAIMING ||
                    (sendLink.status === ESendLinkStatus.FAILED && claimTxSucceeded)
                ) {
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

        // If link is already claimed, cancelled, claiming, or failed (with successful claim tx), that state takes precedence
        // For FAILED: only block if claim tx succeeded (funds left the link to Manteca)
        // If no txHash, the claim tx itself failed and funds are still in the link - user can retry
        const claimTxSucceeded = !!claimLinkData.claim?.txHash

        if (
            claimLinkData.status === ESendLinkStatus.CLAIMED ||
            claimLinkData.status === ESendLinkStatus.CANCELLED ||
            claimLinkData.status === ESendLinkStatus.CLAIMING ||
            (claimLinkData.status === ESendLinkStatus.FAILED && claimTxSucceeded)
        ) {
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
            // resolveClaimLink restores the pristine `#p=` password if an auth/KYC
            // redirect mangled the current URL's fragment (TASK-20193).
            setLinkUrl(resolveClaimLink(pageUrl)) // TanStack Query will automatically fetch when linkUrl changes
        }
    }, [])

    // redirect to bank flow if user is KYC approved and step is bank
    useEffect(() => {
        if (isKycApproved && stepFromURL === 'bank') {
            setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
        }
    }, [isKycApproved])

    return {
        user,
        isFetchingUser,
        linkState,
        setLinkState,
        isSendLinkLoading,
        failureCount,
        refetch,
        setLinkUrl,
        step,
        handleOnNext,
        handleOnPrev,
        handleOnCustom,
        claimLinkData,
        type,
        setType,
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
        selectedTransaction,
        showTransactionReceipt,
        isLinkCancelling,
        setisLinkCancelling,
    }
}
