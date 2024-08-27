'use client'

import { createElement, useState } from 'react'
import * as _consts from './Pay.consts'

export const PayRequestLink = () => {
    const [step, setStep] = useState<_consts.IPayScreenState>(_consts.INIT_VIEW_STATE)

    const [requestLinkData, setRequestLinkData] = useState<_consts.IRequestLinkData>({
        attachmentInfo: {
            message: 'test message',
            attachmentUrl:
                'https://peanut-notes.s3.eu-north-1.amazonaws.com/uploads%2Fpfp_7676141b-d199-4d5c-9d7c-10077ee0fc9e-090a0a88-07e0-4e0f-adbe-c920a757b640',
        },
        requestAddress: '0x1234567890',
        tokenAmount: '100',
        tokenPrice: 1,
        tokenSymbol: 'USDC',
        tokenAddress: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        chainId: '10',
    })

    const [estimatedPoints, setEstimatedPoints] = useState<number>(10)
    const [transactionHash, setTransactionHash] = useState<string>('')

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

    return (
        <div className="card">
            {createElement(_consts.PAY_SCREEN_MAP[step.screen].comp, {
                onNext: handleOnNext,
                onPrev: handleOnPrev,
                requestLinkData,
                estimatedPoints,
                transactionHash,
                setTransactionHash,
            } as _consts.IPayScreenProps)}
        </div>
    )
}
