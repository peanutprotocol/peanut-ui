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
import { useQuery } from '@tanstack/react-query'
import { CrossChainDetails, getCrossChainDetails } from './services/cross-chain'
import { Attachement, CheckLinkReturnType } from './types'

export const Claim = ({}) => {
    const { address } = useAccount()
    const { data, error, isLoading } = useQuery<CheckLinkReturnType>({
        enabled: typeof window !== 'undefined' && address !== undefined,
        queryKey: [address, '-claiming-', window.location.href],
        queryFn: async ({ queryKey }) => {
            const address = queryKey[0] as string
            const link = typeof window !== 'undefined' ? window.location.href : ''
            let linkState: _consts.claimLinkState = 'ALREADY_CLAIMED'
            let crossChainDetails: CrossChainDetails | undefined = undefined
            let tokenPrice: number = 0
            let estimatedPoints: number = 0
            let recipient: { name: string | undefined; address: string } = { name: undefined, address: '' }

            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails({
                link,
            })
            const attachmentInfo = await getAttachmentInfo(linkDetails.link)

            if (linkDetails.claimed) {
                linkState = 'ALREADY_CLAIMED'
            } else {
                crossChainDetails = await getCrossChainDetails(linkDetails)
                tokenPrice =
                    (await utils.fetchTokenPrice(linkDetails.tokenAddress.toLowerCase(), linkDetails.chainId))?.price ??
                    0
                estimatedPoints = await estimatePoints({
                    address,
                    chainId: linkDetails.chainId,
                    amountUSD: Number(linkDetails.tokenAmount) * tokenPrice,
                    actionType: ActionType.CLAIM,
                })

                if (linkDetails.senderAddress === address) {
                    linkState = 'CLAIM_SENDER'
                } else {
                    linkState = 'CLAIM'
                }
            }
            return {
                linkDetails,
                attachmentInfo: {
                    message: attachmentInfo?.message,
                    attachmentUrl: attachmentInfo?.fileUrl,
                },
                crossChainDetails,
                tokenPrice,
                estimatedPoints,
                recipient,
                linkState,
            }
        },
    })
    const [step, setStep] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.claimLinkState>('LOADING')
    const [attachment, setAttachment] = useState<Attachement>({
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

    useEffect(() => {
        if (data) {
            setLinkState(data.linkState)
            setRecipient(data.recipient)
            setTokenPrice(data.tokenPrice)
            setEstimatedPoints(data.estimatedPoints)
            if (data.crossChainDetails) {
                setSelectedChainID(data?.crossChainDetails?.[0]?.chainId)
                setSelectedTokenAddress(data?.crossChainDetails?.[0]?.tokens[0]?.address)
            }
        }
    }, [data])

    return (
        <div className="card">
            {isLoading && (
                <div className="relative flex w-full items-center justify-center">
                    <div className="animate-spin">
                        <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            )}
            {data && linkState === 'CLAIM' && (
                <FlowManager
                    recipientType={recipientType}
                    step={step}
                    props={
                        {
                            onPrev: handleOnPrev,
                            onNext: handleOnNext,
                            onCustom: handleOnCustom,
                            claimLinkData: data.linkDetails,
                            crossChainDetails: data.crossChainDetails,
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

            {data && linkState === 'ALREADY_CLAIMED' && (
                <genericViews.AlreadyClaimedLinkView claimLinkData={data.linkDetails} />
            )}
            {error && <genericViews.NotFoundClaimLink />}
            {data && linkState === 'CLAIM_SENDER' && (
                <genericViews.SenderClaimLinkView
                    changeToRecipientView={() => {
                        setLinkState('CLAIM')
                    }}
                    claimLinkData={data?.linkDetails}
                    setTransactionHash={setTransactionHash}
                    onCustom={handleOnCustom}
                />
            )}
        </div>
    )
}
