'use client'

import { createElement, useEffect, useState, useContext } from 'react'
import * as _consts from './Pay.consts'
import * as assets from '@/assets'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as generalViews from './Views/GeneralViews'
import * as utils from '@/utils'
import * as context from '@/context'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { ActionType, estimatePoints } from '@/components/utils/utils'
import { type ITokenPriceData } from '@/interfaces'
import PageContainer from '@/components/0_Bruddle/PageContainer'

export const PayRequestLink = () => {
    const [step, setStep] = useState<_consts.IPayScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.IRequestLinkState>(_consts.IRequestLinkState.LOADING)
    const [tokenPriceData, setTokenPriceData] = useState<ITokenPriceData | undefined>(undefined)
    const [requestLinkData, setRequestLinkData] = useState<_consts.IRequestLinkData | undefined>(undefined)
    const { estimateGasFee } = useCreateLink()
    const [estimatedPoints, setEstimatedPoints] = useState<number | undefined>(0)
    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)
    const [transactionHash, setTransactionHash] = useState<string>('')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>(undefined)
    const { setLoadingState } = useContext(context.loadingStateContext)
    const { setSelectedChainID, setSelectedTokenAddress } = useContext(context.tokenSelectorContext)
    const [errorMessage, setErrorMessage] = useState<string>('')

    const fetchPointsEstimation = async (
        requestLinkDetails: { recipientAddress: any; chainId: any; tokenAmount: any },
        tokenPriceData: ITokenPriceData | undefined
    ) => {
        const estimatedPoints = await estimatePoints({
            address: requestLinkDetails.recipientAddress,
            chainId: requestLinkDetails.chainId,
            amountUSD: Number(requestLinkDetails.tokenAmount) * (tokenPriceData?.price ?? 0),
            actionType: ActionType.CLAIM, // When API on prod will be ready lets change it to ActionType.FULFILL
        })

        setEstimatedPoints(estimatedPoints)
    }

    const fetchRecipientAddress = async (address: string): Promise<string> => {
        if (!address.endsWith('eth')) {
            return address
        }
        const resolvedAddress = await utils.resolveFromEnsName(address.toLowerCase())
        if (!resolvedAddress) {
            throw new Error('Failed to resolve ENS name')
        }
        return resolvedAddress
    }

    const handleOnNext = () => {
        if (step.idx === _consts.PAY_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.PAY_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
        setLoadingState('Idle')
    }

    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.PAY_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
        setLoadingState('Idle')
    }

    const checkRequestLink = async (pageUrl: string) => {
        try {
            // Fetch request link details
            const requestLinkDetails: any = await peanut.getRequestLinkDetails({
                link: pageUrl,
                APIKey: 'YOUR_API_KEY',
                apiUrl: '/api/proxy/get',
            })

            // Check if request link is not found
            if (requestLinkDetails.error === 'Request link not found') {
                setErrorMessage('This request could not be found. Are you sure your link is correct?')
                setLinkState(_consts.IRequestLinkState.ERROR)
                return
            }

            setRequestLinkData(requestLinkDetails)

            // Check if request link is already paid
            if (requestLinkDetails.status === 'PAID') {
                setLinkState(_consts.IRequestLinkState.ALREADY_PAID)
                return
            }
            // Load the token chain pair from the request link data
            setSelectedChainID(requestLinkDetails.chainId)
            setSelectedTokenAddress(requestLinkDetails.tokenAddress)
            setLinkState(_consts.IRequestLinkState.READY_TO_PAY)
        } catch (error) {
            console.error('Failed to fetch request link details:', error)
            setErrorMessage('This request could not be found. Are you sure your link is correct?')
            setLinkState(_consts.IRequestLinkState.ERROR)
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkRequestLink(pageUrl)
        }
    }, [])

    useEffect(() => {
        if (!requestLinkData) return

        // Fetch token price
        utils
            .fetchTokenPrice(requestLinkData.tokenAddress.toLowerCase(), requestLinkData.chainId)
            .then((tokenPriceData) => {
                if (tokenPriceData) {
                    setTokenPriceData(tokenPriceData)
                } else {
                    setErrorMessage('Failed to fetch token price, please try again later')
                    setLinkState(_consts.IRequestLinkState.ERROR)
                }
            })

        fetchRecipientAddress(requestLinkData.recipientAddress)
            .then((recipientAddress) => {
                const tokenType = Number(requestLinkData.tokenType)
                const { unsignedTx } = peanut.prepareRequestLinkFulfillmentTransaction({
                    recipientAddress: recipientAddress,
                    tokenAddress: requestLinkData.tokenAddress,
                    tokenAmount: requestLinkData.tokenAmount,
                    tokenDecimals: requestLinkData.tokenDecimals,
                    tokenType: tokenType,
                })
                setUnsignedTx(unsignedTx)
            })
            .catch((error) => {
                console.log('error fetching recipient address:', error)
                setErrorMessage('Failed to fetch recipient address, please try again later')
                setLinkState(_consts.IRequestLinkState.ERROR)
            })

        // Prepare request link fulfillment transaction
    }, [requestLinkData])

    useEffect(() => {
        if (!requestLinkData || !tokenPriceData) return
        fetchPointsEstimation(requestLinkData, tokenPriceData).catch((error) => {
            console.log('error fetching points estimation:', error)
        })
    }, [tokenPriceData, requestLinkData])

    useEffect(() => {
        if (!requestLinkData || !unsignedTx) return

        // Estimate gas fee
        estimateGasFee({ chainId: requestLinkData.chainId, preparedTx: unsignedTx })
            .then(({ transactionCostUSD }) => {
                if (transactionCostUSD) setEstimatedGasCost(transactionCostUSD)
            })
            .catch((error) => {
                console.log('error calculating transaction cost:', error)
                setErrorMessage('Failed to estimate gas fee, please try again later')
                setLinkState(_consts.IRequestLinkState.ERROR)
            })
    }, [unsignedTx, requestLinkData])

    return (
        <PageContainer className="h-full">
            {linkState === _consts.IRequestLinkState.ERROR && (
                <div className="relative flex w-full items-center justify-center">
                    <div className="animate-spin">
                        <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            )}
            {linkState === _consts.IRequestLinkState.READY_TO_PAY &&
                createElement(_consts.PAY_SCREEN_MAP[step.screen].comp, {
                    onNext: handleOnNext,
                    onPrev: handleOnPrev,
                    requestLinkData,
                    estimatedPoints,
                    transactionHash,
                    setTransactionHash,
                    tokenPriceData,
                    estimatedGasCost,
                    unsignedTx,
                } as _consts.IPayScreenProps)}
            {linkState === _consts.IRequestLinkState.ERROR && <generalViews.ErrorView errorMessage={errorMessage} />}
            {linkState === _consts.IRequestLinkState.CANCELED && <generalViews.CanceledClaimLink />}
            {linkState === _consts.IRequestLinkState.ALREADY_PAID && (
                <generalViews.AlreadyPaidLinkView requestLinkData={requestLinkData} />
            )}
        </PageContainer>
    )
}
