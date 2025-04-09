'use client'

import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { createElement, Suspense, useContext, useEffect, useState } from 'react'

import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { fetchWithSentry, rankAddressesByInteractions } from '@/utils'
import PageContainer from '../0_Bruddle/PageContainer'
import {
    CREATE_SCREEN_FLOW,
    CREATE_SCREEN_MAP,
    CreateType,
    IAttachmentOptions,
    ICreateScreenProps,
    ICreateScreenState,
    INIT_VIEW_STATE,
} from './Create.consts'

export const Create = () => {
    const [step, setStep] = useState<ICreateScreenState>(INIT_VIEW_STATE)
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)
    const [usdValue, setUsdValue] = useState<undefined | string>(undefined)

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
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        fileUrl: undefined,
        message: undefined,
        rawFile: undefined,
    })

    const [createType, setCreateType] = useState<CreateType>(undefined)
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

    const { address } = useWallet()

    const { resetTokenContextProvider } = useContext(tokenSelectorContext)

    const handleOnNext = () => {
        if (step.idx === CREATE_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: CREATE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const fetchRecentTransactions = async () => {
        const response = await fetchWithSentry('/api/recent-transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: address,
            }),
        })
        const data = await response.json()
        const recentRanked = (await rankAddressesByInteractions(data.data.portfolios)).slice(0, 3)
        setRecentRecipients(recentRanked)
    }

    const fetchAndSetCrossChainDetails = async () => {
        const response = await fetchWithSentry('https://apiplus.squidrouter.com/v2/chains', {
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
        <Suspense>
            <PageContainer>
                <div className="max-w-xl">
                    {createElement(CREATE_SCREEN_MAP[step.screen].comp, {
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
                    } as ICreateScreenProps)}
                </div>
            </PageContainer>
        </Suspense>
    )
}
