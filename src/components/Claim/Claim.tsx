'use client'
import { useEffect, useState, useContext } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
import useClaimLink from './useClaimLink'

import * as genericViews from './Generic'
import * as _consts from './Claim.consts'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import * as context from '@/context'
import * as assets from '@/assets'
import * as consts from '@/constants'
import * as _utils from './Claim.utils'
import FlowManager from './Link/FlowManager'
import { ActionType, estimatePoints } from '../utils/utils'

export const Claim = ({}) => {
    const [step, setStep] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.claimLinkStateType>(_consts.claimLinkStateType.LOADING)
    const [claimLinkData, setClaimLinkData] = useState<interfaces.ILinkDetails | undefined>(undefined)
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

    const { setSelectedChainID, setSelectedTokenAddress } = useContext(context.tokenSelectorContext)

    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [userType, setUserType] = useState<'NEW' | 'EXISTING' | undefined>(undefined)
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const { address } = useAccount()
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
            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails({
                link,
            })
            const attachmentInfo = await getAttachmentInfo(linkDetails.link)
            setAttachment({
                message: attachmentInfo?.message,
                attachmentUrl: attachmentInfo?.fileUrl,
            })

            setClaimLinkData(linkDetails)
            setSelectedChainID(linkDetails.chainId)
            setSelectedTokenAddress(linkDetails.tokenAddress)

            if (linkDetails.claimed) {
                setLinkState(_consts.claimLinkStateType.ALREADY_CLAIMED)
                return
            }

            const tokenPrice = await utils.fetchTokenPrice(linkDetails.tokenAddress.toLowerCase(), linkDetails.chainId)
            tokenPrice && setTokenPrice(tokenPrice?.price)

            if (address) {
                setRecipient({ name: '', address })

                const estimatedPoints = await estimatePoints({
                    address: address ?? '',
                    chainId: linkDetails.chainId,
                    amountUSD: Number(linkDetails.tokenAmount) * (tokenPrice?.price ?? 0),
                    actionType: ActionType.CLAIM,
                })
                setEstimatedPoints(estimatedPoints)
            }

            if (address && linkDetails.senderAddress === address) {
                setLinkState(_consts.claimLinkStateType.CLAIM_SENDER)
            } else {
                setLinkState(_consts.claimLinkStateType.CLAIM)
            }
        } catch (error) {
            setLinkState(_consts.claimLinkStateType.NOT_FOUND)
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [])

    return (
        <div className="card">
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
        </div>
    )
}
