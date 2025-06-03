'use client'
import peanut from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { fetchTokenDetails, fetchTokenPrice } from '@/app/actions/tokens'
import { StatusType } from '@/components/Global/Badges/StatusBadge'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import * as consts from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import * as interfaces from '@/interfaces'
import { ESendLinkStatus, sendLinksApi, type ClaimLinkData } from '@/services/sendLinks'
import { getInitialsFromName, getTokenDetails, isStableCoin } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import PageContainer from '../0_Bruddle/PageContainer'
import PeanutLoading from '../Global/PeanutLoading'
import * as _consts from './Claim.consts'
import * as genericViews from './Generic'
import FlowManager from './Link/FlowManager'

export const Claim = ({}) => {
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
    const [selectedRoute, setSelectedRoute] = useState<any>(undefined)
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
    const { isDrawerOpen, selectedTransaction, openTransactionDetails } = useTransactionDetailsDrawer()
    const router = useRouter()

    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [userType, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const { address } = useWallet()
    const { user } = useAuth()

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
            },
            userName:
                claimLinkData.claim?.recipient?.username ?? claimLinkData.claim?.recipientAddress ?? 'Send via Link',
            sourceView: 'history',
            peanutFeeDetails: {
                amountDisplay: '$ 0.00',
            },
        }

        return details as TransactionDetails
    }, [claimLinkData])

    const handleOnNext = () => {
        if (step.idx === _consts.CLAIM_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CLAIM_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
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
    const checkLink = useCallback(
        async (link: string) => {
            try {
                const url = new URL(link)
                const password = url.hash.split('=')[1]
                const sendLink = await sendLinksApi.get(link)
                setAttachment({
                    message: sendLink.textContent,
                    attachmentUrl: sendLink.fileUrl,
                })

                const tokenDetails = await fetchTokenDetails(sendLink.tokenAddress, sendLink.chainId)
                setClaimLinkData({
                    ...sendLink,
                    link,
                    password,
                    tokenSymbol: tokenDetails.symbol,
                    tokenDecimals: tokenDetails.decimals,
                })
                setSelectedChainID(sendLink.chainId)
                setSelectedTokenAddress(sendLink.tokenAddress)
                const keyPair = peanut.generateKeysFromString(password)
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

                if (user && user.user.userId === sendLink.sender?.userId) {
                    setLinkState(_consts.claimLinkStateType.CLAIM_SENDER)
                } else {
                    setLinkState(_consts.claimLinkStateType.CLAIM)
                }
            } catch (error) {
                console.error(error)
                setLinkState(_consts.claimLinkStateType.NOT_FOUND)
                Sentry.captureException(error)
            }
        },
        [user]
    )

    useEffect(() => {
        if (address) {
            setRecipient({ name: '', address })
        }
    }, [address])

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [user])

    useEffect(() => {
        if (!transactionForDrawer) return
        if (
            linkState === _consts.claimLinkStateType.CLAIM_SENDER ||
            linkState === _consts.claimLinkStateType.ALREADY_CLAIMED
        ) {
            openTransactionDetails(transactionForDrawer)
        }
    }, [linkState, transactionForDrawer])

    return (
        <PageContainer className="min-h-[inherit] pb-5">
            {linkState === _consts.claimLinkStateType.LOADING && <PeanutLoading />}
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
            {linkState === _consts.claimLinkStateType.WRONG_PASSWORD && <genericViews.WrongPasswordClaimLink />}
            {linkState === _consts.claimLinkStateType.NOT_FOUND && <genericViews.NotFoundClaimLink />}
            <TransactionDetailsReceipt transaction={selectedTransaction} />
        </PageContainer>
    )
}
