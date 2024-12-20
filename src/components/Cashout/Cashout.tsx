'use client'
import { createElement, useEffect, useState } from 'react'
import * as _consts from './Cashout.consts'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import * as consts from '@/constants'
import { OfframpType } from '../Offramp/Offramp.consts'

export const Cashout = ({}) => {
    const [step, setStep] = useState<_consts.ICashoutScreenState>(_consts.INIT_VIEW_STATE)
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)
    const [usdValue, setUsdValue] = useState<undefined | string>(undefined)
    const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)

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

    const [createType, setCreateType] = useState<_consts.CashoutType>(undefined)
    const [recipient, setRecipient] = useState<{ address: string | undefined; name: string | undefined }>({
        address: undefined,
        name: undefined,
    })

    const [offrampForm, setOfframpForm] = useState<consts.IOfframpForm>({
        name: '',
        email: '',
        password: '',
        recipient: '',
    })

    const [transactionHash, setTransactionHash] = useState<string | undefined>(undefined)
    const [initialKYCStep, setInitialKYCStep] = useState<number>(0)

    const [preparedCreateLinkWrapperResponse, setPreparedCreateLinkWrapperResponse] = useState<
        | {
              type: string
              response: any
              linkDetails: peanutInterfaces.IPeanutLinkDetails
              password: string
              feeOptions?: any
              usdValue?: string
          }
        | undefined
    >(undefined)

    const handleOnNext = () => {
        if (step.idx === _consts.CASHOUT_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CASHOUT_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }
    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.CASHOUT_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }
    const [crossChainDetails, setCrossChainDetails] = useState<[]>([])

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
        fetchAndSetCrossChainDetails()
    }, [])

    // For testing - check if URL has screen param
    useEffect(() => {
        if (typeof window === 'undefined') return

        const params = new URLSearchParams(window.location.search)
        const screen = params.get('screen')

        if (screen === 'success') {
            setStep({
                screen: 'SUCCESS',
                idx: _consts.CASHOUT_SCREEN_FLOW.indexOf('SUCCESS'),
            })
            // Set test data for success view
            setOfframpForm({
                name: 'Test User',
                email: 'test@example.com',
                password: '',
                recipient: 'DE89370400440532013000',
            })
            setUsdValue('100')
        } else if (screen === 'confirm') {
            setStep({
                screen: 'CONFIRM',
                idx: _consts.CASHOUT_SCREEN_FLOW.indexOf('CONFIRM'),
            })
            // Set test data for confirm view
            setOfframpForm({
                name: 'Test User',
                email: 'test@example.com',
                password: '',
                recipient: 'DE89370400440532013000',
            })
            setUsdValue('100')
            setInitialKYCStep(4) // Skip KYC steps
        }
    }, [])

    return (
        <div className="card">
            {createElement(_consts.CASHOUT_SCREEN_MAP[step.screen].comp, {
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
                createType,
                setCreateType,
                recipient,
                setRecipient,
                usdValue,
                setUsdValue,
                preparedCreateLinkWrapperResponse,
                setPreparedCreateLinkWrapperResponse,
                offrampForm,
                setOfframpForm,
                initialKYCStep,
                setInitialKYCStep,
                transactionHash,
                setTransactionHash,
                crossChainDetails,
                offrampType: OfframpType.CASHOUT,
                appliedPromoCode,
                onPromoCodeApplied: setAppliedPromoCode,
            } as any)}
        </div>
    )
}
