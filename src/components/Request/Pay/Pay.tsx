'use client'

import { createElement, useEffect, useState } from 'react'
import * as _consts from './Pay.consts'
import * as assets from '@/assets'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as generalViews from './Views/GeneralViews'
import * as utils from '@/utils'
import { useCreateLink } from '@/components/Create/useCreateLink'

export const PayRequestLink = () => {
    const [step, setStep] = useState<_consts.IPayScreenState>(_consts.INIT_VIEW_STATE)
    const [linkState, setLinkState] = useState<_consts.IRequestLinkState>('LOADING')
    const [tokenPrice, setTokenPrice] = useState<number>(0)
    const [requestLinkData, setRequestLinkData] = useState<_consts.IRequestLinkData | undefined>(undefined)
    const { estimateGasFee } = useCreateLink()
    const [estimatedPoints, setEstimatedPoints] = useState<number | undefined>(10)
    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)
    const [transactionHash, setTransactionHash] = useState<string>('')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | undefined>(undefined)

    const handleOnNext = () => {
        if (step.idx === _consts.PAY_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.PAY_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.PAY_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
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
                setLinkState('NOT_FOUND')
                return
            }
            // Check if request link is already paid
            if (requestLinkDetails.status === 'PAID') {
                setLinkState('ALREADY_PAID')
                return
            }

            // Fetch token price
            const tokenPrice = await utils.fetchTokenPrice(
                requestLinkDetails.tokenAddress.toLowerCase(),
                requestLinkDetails.chainId
            )
            tokenPrice && setTokenPrice(tokenPrice?.price)

            let recipientAddress = requestLinkDetails.recipientAddress
            if (requestLinkDetails.recipientAddress.endsWith('eth')) {
                recipientAddress = await utils.resolveFromEnsName(requestLinkDetails.recipientAddress.toLowerCase())
            }

            // Prepare request link fulfillment transaction
            const tokenType = Number(requestLinkDetails.tokenType)
            const { unsignedTx } = peanut.prepareRequestLinkFulfillmentTransaction({
                recipientAddress: recipientAddress,
                tokenAddress: requestLinkDetails.tokenAddress,
                tokenAmount: requestLinkDetails.tokenAmount,
                tokenDecimals: requestLinkDetails.tokenDecimals,
                tokenType: tokenType,
            })
            setUnsignedTx(unsignedTx)

            // Estimate gas fee
            try {
                const { transactionCostUSD: _transactionCostUSD } = await estimateGasFee({
                    chainId: requestLinkDetails.chainId,
                    preparedTx: unsignedTx,
                })

                console.log('transactionCostUSD:', _transactionCostUSD)
                if (_transactionCostUSD) setEstimatedGasCost(_transactionCostUSD)
            } catch (error) {
                console.log('error calculating transaction cost:', error)
            }

            // TODO: points calculation

            setRequestLinkData(requestLinkDetails)
            setLinkState('PAY')
        } catch (error) {
            console.error('Failed to fetch request link details:', error)
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkRequestLink(pageUrl)
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
            {linkState === 'PAY' &&
                createElement(_consts.PAY_SCREEN_MAP[step.screen].comp, {
                    onNext: handleOnNext,
                    onPrev: handleOnPrev,
                    requestLinkData,
                    estimatedPoints,
                    transactionHash,
                    setTransactionHash,
                    tokenPrice,
                    estimatedGasCost,
                    unsignedTx,
                } as _consts.IPayScreenProps)}
            {linkState === 'NOT_FOUND' && <generalViews.NotFoundClaimLink />}
            {linkState === 'ALREADY_PAID' && <generalViews.AlreadyPaidLinkView requestLinkData={requestLinkData} />}
        </div>
    )
}
