'use client'
import { createElement, useEffect, useState, useContext } from 'react'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as genericViews from './Generic'
import * as _consts from './Claim.consts'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import * as context from '@/context'
import * as assets from '@/assets'
import { useAccount } from 'wagmi'
export const Claim = ({}) => {
    const [step, setStep] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.claimLinkState>('LOADING')
    const [claimLinkData, setClaimLinkData] = useState<interfaces.ILinkDetails | undefined>(undefined)
    const [crossChainDetails, setCrossChainDetails] = useState<
        Array<peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }> | undefined
    >(undefined)
    const [type, setType] = useState<_consts.ClaimType | undefined>(undefined)
    const [recipientAddress, setRecipientAddress] = useState<string | undefined>(undefined)
    const [tokenPrice, setTokenPrice] = useState<number>(0)

    const [transactionHash, setTransactionHash] = useState<string>()

    const { selectedChainID, setSelectedChainID, setSelectedTokenAddress } = useContext(context.tokenSelectorContext)

    const { address } = useAccount()

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

    const getCrossChainDetails = async (linkDetails: interfaces.ILinkDetails) => {
        // xchain is only available for native and erc20
        if (linkDetails.tokenType != 0 && linkDetails.tokenType != 1) {
            return undefined
        }

        try {
            const crossChainDetails = await peanut.getXChainOptionsForLink({
                isTestnet: utils.isTestnetChain(linkDetails.chainId.toString()),
                sourceChainId: linkDetails.chainId.toString(),
                tokenType: linkDetails.tokenType,
            })

            const contractVersionCheck = peanut.compareVersions('v4.2', linkDetails.contractVersion, 'v') // v4.2 is the minimum version required for cross chain
            if (crossChainDetails.length > 0 && contractVersionCheck) {
                const xchainDetails = crossChainDetails.filter((chain: any) => chain.chainId != '1')
                setSelectedChainID(xchainDetails[0].chainId)
                setSelectedTokenAddress(xchainDetails[0].tokens[0].address)
                return xchainDetails
            } else {
                return undefined
            }
        } catch (error) {
            console.log('error fetching cross chain details: ' + error)
            return undefined
        }
    }

    const checkLink = async (link: string) => {
        try {
            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails({
                link,
            })

            setClaimLinkData(linkDetails)
            if (linkDetails.claimed) {
                setLinkState('ALREADY_CLAIMED')
            } else if (address && linkDetails.senderAddress === address) {
                setLinkState('CLAIM_SENDER')
            } else {
                const crossChainDetails = await getCrossChainDetails(linkDetails)
                setCrossChainDetails(crossChainDetails)
                const tokenPrice = await utils.fetchTokenPrice(linkDetails.tokenAddress, linkDetails.chainId)
                tokenPrice && setTokenPrice(tokenPrice?.price)
                setLinkState('CLAIM')
            }
        } catch (error) {
            setLinkState('NOT_FOUND')
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
            {linkState === 'LOADING' && (
                <div className="relative flex w-full items-center justify-center">
                    <div className="animate-spin">
                        <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            )}
            {linkState === 'CLAIM' &&
                createElement(_consts.CLAIM_SCREEN_MAP[step.screen].comp, {
                    onPrev: handleOnPrev,
                    onNext: handleOnNext,
                    onCustom: handleOnCustom,
                    claimLinkData,
                    crossChainDetails,
                    type,
                    setClaimType: setType,
                    recipientAddress,
                    setRecipientAddress,
                    tokenPrice,
                    setTokenPrice,
                    transactionHash,
                    setTransactionHash,
                } as _consts.IClaimScreenProps)}
            {linkState === 'ALREADY_CLAIMED' && <genericViews.AlreadyClaimedLinkView claimLinkData={claimLinkData} />}
            {linkState === 'NOT_FOUND' && <genericViews.NotFoundClaimLink />}
            {linkState === 'CLAIM_SENDER' && (
                <genericViews.SenderClaimLinkView
                    changeToRecipientView={() => {
                        setLinkState('CLAIM')
                    }}
                    claimLinkData={claimLinkData}
                    setTransactionHash={setTransactionHash}
                    onCustom={handleOnCustom}
                />
            )}
        </div>
    )
}
