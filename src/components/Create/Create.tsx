'use client'

import { createElement, useContext, useEffect, useState } from 'react'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as _consts from './Create.consts'
import * as context from '@/context'
import * as utils from '@/utils'
import { useWeb3InboxAccount, useWeb3InboxClient } from '@web3inbox/react'
import { useAccount } from 'wagmi'
import SafeAppsSDK from '@safe-global/safe-apps-sdk'
import { useBalance } from '@/hooks/useBalance'

export const Create = () => {
    const [step, setStep] = useState<_consts.ICreateScreenState>(_consts.INIT_VIEW_STATE)
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)
    const [usdValue, setUsdValue] = useState<undefined | string>(undefined)
    const sdk = new SafeAppsSDK()

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
    const [estimatedPoints, setEstimatedPoints] = useState<number | undefined>(undefined)
    const [attachmentOptions, setAttachmentOptions] = useState<_consts.IAttachmentOptions>({
        fileUrl: undefined,
        message: undefined,
        rawFile: undefined,
    })

    const [createType, setCreateType] = useState<_consts.CreateType>(undefined)
    const [recipient, setRecipient] = useState<{ address: string | undefined; name: string | undefined }>({
        address: undefined,
        name: undefined,
    })
    const [crossChainDetails, setCrossChainDetails] = useState<[]>([])

    const [recentRecipients, setRecentRecipients] = useState<
        {
            address: string
            count: any
            mostRecentInteraction: any
        }[]
    >([])

    const { setAccount } = useWeb3InboxAccount()
    const { data: w3iClient, isLoading: w3iClientIsLoading } = useWeb3InboxClient()
    const { address } = useAccount({})

    const { resetTokenContextProvider } = useContext(context.tokenSelectorContext)
    useBalance() // Fetch balances here, decreases load time on input screen for tokenselector

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

    const fetchRecentTransactions = async () => {
        const response = await fetch('/api/recent-transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: address,
            }),
        })
        const data = await response.json()
        const recentRanked = (await utils.rankAddressesByInteractions(data.data.portfolios)).slice(0, 3)
        setRecentRecipients(recentRanked)
    }

    const fetchAndSetCrossChainDetails = async () => {
        const response = await fetch('https://apiplus.squidrouter.com/v2/chains', {
            headers: {
                'x-integrator-id': '11CBA45B-5EE9-4331-B146-48CCD7ED4C7C',
            },
        })
        if (!response.ok) {
            throw new Error('Squid: Network response was not ok')
        }
        const data = await response.json()

        setCrossChainDetails(data.chains)
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

    useEffect(() => {
        resetTokenContextProvider()
        fetchAndSetCrossChainDetails()
    }, [])

    useEffect(() => {
        if (address) {
            fetchRecentTransactions()
        } else {
            setRecentRecipients([])
        }
    }, [address])

    return (
        <div className="card">
            {createElement(_consts.CREATE_SCREEN_MAP[step.screen].comp, {
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
                estimatedPoints,
                setEstimatedPoints,
                attachmentOptions,
                setAttachmentOptions,
                createType,
                setCreateType,
                recipient,
                setRecipient,
                recentRecipients,

                crossChainDetails,
                usdValue,
                setUsdValue,
            } as _consts.ICreateScreenProps)}
        </div>
    )
}
