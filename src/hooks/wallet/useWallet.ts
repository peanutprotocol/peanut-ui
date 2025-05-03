'use client'

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    peanutPublicClient,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    pintaPublicClient,
} from '@/constants'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { formatAmount } from '@/utils'
import { useCallback, useEffect } from 'react'
import { erc20Abi, formatUnits, getAddress } from 'viem'
import type { Hex } from 'viem'
import { useZeroDev } from '../useZeroDev'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const { balance } = useWalletStore()

    const sendTransactions = useCallback(
        async (unsignedTxs: peanutInterfaces.IPeanutUnsignedTransaction[], chainId?: string) => {
            const params = unsignedTxs.map((tx: peanutInterfaces.IPeanutUnsignedTransaction) => ({
                to: tx.to! as Hex,
                value: tx.value?.valueOf(),
                data: tx.data as Hex | undefined,
            }))
            chainId = chainId ?? PEANUT_WALLET_CHAIN.id.toString()
            let receipt = await handleSendUserOpEncoded(params, chainId)
            return receipt
        },
        [handleSendUserOpEncoded]
    )

    const fetchBalance = useCallback(async () => {
        if (!address) return
        const balance = await peanutPublicClient.readContract({
            address: PEANUT_WALLET_TOKEN,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Hex],
        })
        dispatch(walletActions.setBalance(balance))
    }, [address])

    const getRewardWalletBalance = useCallback(async () => {
        if (!address) return ''
        const balance = await pintaPublicClient.readContract({
            address: PINTA_WALLET_TOKEN,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [getAddress(address)],
        })
        const formatedBalance = formatAmount(formatUnits(balance, PINTA_WALLET_TOKEN_DECIMALS))
        dispatch(walletActions.setRewardWalletBalance(formatedBalance))
    }, [address])

    useEffect(() => {
        if (!address) return
        fetchBalance()
        getRewardWalletBalance()
    }, [address, fetchBalance, getRewardWalletBalance])

    return {
        address: address!,
        balance: BigInt(balance),
        isConnected: isKernelClientReady,
        sendTransactions,
        getRewardWalletBalance,
        fetchBalance,
    }
}
