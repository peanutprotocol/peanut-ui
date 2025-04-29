'use client'
import peanut from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect, useState } from 'react'
import useClaimLink from './useClaimLink'

import * as assets from '@/assets'
import * as consts from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import * as interfaces from '@/interfaces'
import * as Sentry from '@sentry/nextjs'
import PageContainer from '../0_Bruddle/PageContainer'
import { ActionType, estimatePoints } from '../utils/utils'
import * as _consts from './Claim.consts'
import * as genericViews from './Generic'
import FlowManager from './Link/FlowManager'
import { fetchTokenPrice } from '@/app/actions/tokens'
import { sendLinksApi, type ClaimLinkData, ESendLinkStatus } from '@/services/sendLinks'
import { useAuth } from '@/context/authContext'
import { fetchTokenDetails } from '@/app/actions/tokens'
import { formatUnits } from 'viem'
import { isStableCoin } from '@/utils'

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

    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [userType, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const { address } = useWallet()
    const { user } = useAuth()
    const { getAttachmentInfo } = useClaimLink()

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
    const checkLink = async (link: string) => {
        try {
            const url = new URL(link)
            const password = url.hash.split('=')[1]
            const [sendLink, attachmentInfo] = await Promise.all([sendLinksApi.get(link), getAttachmentInfo(link)])
            setAttachment({
                message: attachmentInfo?.message,
                attachmentUrl: attachmentInfo?.fileUrl,
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
                const tokenPriceDetails = await fetchTokenPrice(sendLink.tokenAddress.toLowerCase(), sendLink.chainId)
                if (tokenPriceDetails) {
                    price = tokenPriceDetails.price
                }
            }
            if (0 < price) setTokenPrice(price)

            if (address) {
                setRecipient({ name: '', address })

                const amountUsd = formatUnits(sendLink.amount * BigInt(price), tokenDetails.decimals)
                const estimatedPoints = await estimatePoints({
                    address: address ?? '',
                    chainId: sendLink.chainId,
                    amountUSD: Number(amountUsd),
                    actionType: ActionType.CLAIM,
                })
                setEstimatedPoints(estimatedPoints)
            }

            if (user && user.user.userId === sendLink.sender.userId) {
                setLinkState(_consts.claimLinkStateType.CLAIM_SENDER)
            } else {
                setLinkState(_consts.claimLinkStateType.CLAIM)
            }
        } catch (error) {
            console.error(error)
            setLinkState(_consts.claimLinkStateType.NOT_FOUND)
            Sentry.captureException(error)
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [])

    return (
        <PageContainer>
            {linkState === _consts.claimLinkStateType.LOADING && (
                <div className="relative flex w-full items-center justify-center">
                    <div className="animate-spin">
                        <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="sr-only">Loading...</span>
                    </div>
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
                        } as _consts.IClaimScreenProps
                    }
                />
            )}
            {linkState === _consts.claimLinkStateType.WRONG_PASSWORD && <genericViews.WrongPasswordClaimLink />}
            {linkState === _consts.claimLinkStateType.ALREADY_CLAIMED && (
                <genericViews.AlreadyClaimedLinkView claimLinkData={claimLinkData} />
            )}
            {linkState === _consts.claimLinkStateType.NOT_FOUND && <genericViews.NotFoundClaimLink />}
            {linkState === _consts.claimLinkStateType.CLAIM_SENDER && (
                <genericViews.SenderClaimLinkView
                    changeToRecipientView={() => {
                        setLinkState(_consts.claimLinkStateType.CLAIM)
                    }}
                    claimLinkData={claimLinkData}
                    setTransactionHash={setTransactionHash}
                    onCustom={handleOnCustom}
                />
            )}
        </PageContainer>
    )
}
