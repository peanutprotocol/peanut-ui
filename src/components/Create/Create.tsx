'use client'

import { createElement, useEffect, useState } from 'react'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as _consts from './Create.consts'
import Layout from '../Global/Layout'
import { useWeb3InboxAccount, useWeb3InboxClient } from '@web3inbox/react'
import { useAccount } from 'wagmi'

export const Create = ({ type }: { type: _consts.CreateType }) => {
    const [step, setStep] = useState<_consts.ICreateScreenState>(_consts.INIT_VIEW_STATE)
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)

    const [linkDetails, setLinkDetails] = useState<peanutInterfaces.IPeanutLinkDetails>()
    const [password, setPassword] = useState<string>('')
    const [transactionType, setTransactionType] = useState<'not-gasless' | 'gasless'>('not-gasless')

    const [gaslessPayload, setGaslessPayload] = useState<peanutInterfaces.IGaslessDepositPayload | undefined>()
    const [gaslessPayloadMessage, setGaslessPayloadMessage] = useState<
        peanutInterfaces.IPreparedEIP712Message | undefined
    >()
    const [preparedDepositTxs, setPreparedDepositTxs] = useState<
        peanutInterfaces.IPrepareDepositTxsResponse | undefined
    >()

    const [txHash, setTxHash] = useState<string>('')
    const [link, setLink] = useState<string>('')

    const [feeOptions, setFeeOptions] = useState<any | undefined>(undefined)
    const [transactionCostUSD, setTransactionCostUSD] = useState<number | undefined>(undefined)

    const { setAccount } = useWeb3InboxAccount()
    const { data: w3iClient, isLoading: w3iClientIsLoading } = useWeb3InboxClient()
    const { address } = useAccount({})

    const handleOnNext = () => {
        if (step.idx === _consts.CREATE_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    useEffect(() => {
        if (!Boolean(address)) return
        if (w3iClientIsLoading) return
        setAccount(`eip155:1:${address}`)
    }, [address, w3iClientIsLoading])

    useEffect(() => {
        if (!address && w3iClient) {
            setAccount('')
        }
    }, [address, w3iClient])

    return (
        <div className="card">
            {type === 'normal' &&
                createElement(_consts.CREATE_SCREEN_MAP[step.screen].comp, {
                    onPrev: handleOnPrev,
                    onNext: handleOnNext,
                    tokenValue: tokenValue,
                    setTokenValue: setTokenValue,
                    linkDetails: linkDetails,
                    setLinkDetails: setLinkDetails,
                    password: password,
                    setPassword: setPassword,
                    transactionType: transactionType,
                    setTransactionType: setTransactionType,
                    gaslessPayload: gaslessPayload,
                    setGaslessPayload: setGaslessPayload,
                    gaslessPayloadMessage: gaslessPayloadMessage,
                    setGaslessPayloadMessage: setGaslessPayloadMessage,
                    preparedDepositTxs: preparedDepositTxs,
                    setPreparedDepositTxs: setPreparedDepositTxs,
                    txHash: txHash,
                    setTxHash: setTxHash,
                    link: link,
                    setLink: setLink,
                    feeOptions,
                    setFeeOptions,
                    transactionCostUSD,
                    setTransactionCostUSD,
                } as _consts.ICreateScreenProps)}
        </div>
    )
}
