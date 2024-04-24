'use client'
import { createElement, useEffect, useState } from 'react'
import * as global_components from '@/components/global'
import * as _consts from './send.consts'
import { useWeb3InboxAccount, useWeb3InboxClient } from '@web3inbox/react'
import { useAccount } from 'wagmi'

export function Send({ type }: { type: 'normal' | 'raffle' | 'batch' }) {
    const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(_consts.INIT_VIEW)
    const [claimLink, setClaimLink] = useState<string | string[]>('')
    const [txHash, setTxHash] = useState<string>('')
    const [chainId, setChainId] = useState<string>('1')
    const { setAccount } = useWeb3InboxAccount()
    const { data: w3iClient, isLoading: w3iClientIsLoading } = useWeb3InboxClient()
    const { address } = useAccount({})

    useEffect(() => {
        if (!Boolean(address)) return
        if (w3iClientIsLoading) return
        setAccount(`eip155:1:${address}`)
    }, [address, w3iClientIsLoading])

    const handleOnNext = () => {
        const newIdx = sendScreen.idx + 1
        setSendScreen(() => ({
            screen: _consts.SEND_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.SendScreens) => {
        setSendScreen(() => ({
            screen: screen,
            idx: _consts.SEND_SCREEN_FLOW.indexOf(screen),
        }))
    }

    useEffect(() => {
        if (!address && w3iClient) {
            setAccount('')
        }
    }, [address, w3iClient])

    return (
        <global_components.PageWrapper bgColor={type === 'raffle' ? ' bg-red' : undefined}>
            {type == 'normal' && (
                <global_components.CardWrapper mt=" mt-16 " shadow>
                    {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
                        onNextScreen: handleOnNext,
                        onCustomScreen: handleOnCustom,
                        claimLink,
                        setClaimLink,
                        txHash,
                        setTxHash,
                        chainId,
                        setChainId,
                    } as _consts.ISendScreenProps)}
                </global_components.CardWrapper>
            )}
            {type == 'raffle' && (
                <global_components.CardWrapper mt=" mt-16 " shadow>
                    {createElement(_consts.RAFFLE_SEND_SCREEN_MAP[sendScreen.screen].comp, {
                        onNextScreen: handleOnNext,
                        onCustomScreen: handleOnCustom,
                        claimLink,
                        setClaimLink,
                        txHash,
                        setTxHash,
                        chainId,
                        setChainId,
                    } as _consts.ISendScreenProps)}
                </global_components.CardWrapper>
            )}
            {type == 'batch' && (
                <global_components.CardWrapper mt=" mt-16 " shadow>
                    {createElement(_consts.BATCH_SEND_SCREEN_MAP[sendScreen.screen].comp, {
                        onNextScreen: handleOnNext,
                        onCustomScreen: handleOnCustom,
                        claimLink,
                        setClaimLink,
                        txHash,
                        setTxHash,
                        chainId,
                        setChainId,
                    } as _consts.ISendScreenProps)}
                </global_components.CardWrapper>
            )}
        </global_components.PageWrapper>
    )
}
