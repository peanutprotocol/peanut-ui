'use client'

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    peanutPublicClient,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    pintaPublicClient,
} from '@/constants'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { formatAmount } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useEffect, useState } from 'react'
import type { Hex, Address } from 'viem'
import { erc20Abi, formatUnits, parseUnits, encodeFunctionData, getAddress } from 'viem'
import { useZeroDev } from '../useZeroDev'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const [isFetchingBalance, setIsFetchingBalance] = useState(true)
    const [isFetchingRewardBalance, setIsFetchingRewardBalance] = useState(true)
    const { balance } = useWalletStore()

    const sendMoney = useCallback(
        async (toAddress: Address, amountInUsd: string) => {
            const amountToSend = parseUnits(amountInUsd, PEANUT_WALLET_TOKEN_DECIMALS)

            const txData = encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [toAddress, amountToSend],
            })

            const transaction: peanutInterfaces.IPeanutUnsignedTransaction = {
                to: PEANUT_WALLET_TOKEN,
                data: txData,
            }

            return await sendTransactions([transaction], PEANUT_WALLET_CHAIN.id.toString())
        },
        [handleSendUserOpEncoded]
    )

    const sendTransactions = useCallback(
        async (unsignedTxs: peanutInterfaces.IPeanutUnsignedTransaction[], chainId?: string) => {
            const params = unsignedTxs.map((tx: peanutInterfaces.IPeanutUnsignedTransaction) => ({
                to: tx.to! as Hex,
                value: tx.value?.valueOf() ?? 0n,
                data: (tx.data as Hex | undefined) ?? '0x',
            }))
            chainId = chainId ?? PEANUT_WALLET_CHAIN.id.toString()
            let receipt = await handleSendUserOpEncoded(params, chainId)
            return receipt
        },
        [handleSendUserOpEncoded]
    )

    const fetchBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch balance, address is undefined.')
            return
        }
        await peanutPublicClient
            .readContract({
                address: PEANUT_WALLET_TOKEN,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address as Hex],
            })
            .then((balance) => {
                dispatch(walletActions.setBalance(balance))
                setIsFetchingBalance(false)
            })
            .catch((error) => {
                console.error('Error fetching balance:', error)
                setIsFetchingBalance(false)
            })
    }, [address, dispatch])

    const getRewardWalletBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch reward balance, address is undefined.')
            return ''
        }
        await pintaPublicClient
            .readContract({
                address: PINTA_WALLET_TOKEN,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [getAddress(address)],
            })
            .then((balance) => {
                const formatedBalance = formatAmount(formatUnits(balance, PINTA_WALLET_TOKEN_DECIMALS))
                dispatch(walletActions.setRewardWalletBalance(formatedBalance))
                setIsFetchingRewardBalance(false)
            })
            .catch((error) => {
                console.error('Error fetching reward balance:', error)
                setIsFetchingRewardBalance(false)
            })
    }, [address, dispatch])

    useEffect(() => {
        if (!address) return
        fetchBalance()
        getRewardWalletBalance()
    }, [address, fetchBalance, getRewardWalletBalance])

    return {
        address: address!,
        balance: balance ? BigInt(balance) : undefined,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        getRewardWalletBalance,
        fetchBalance,
        isFetchingBalance,
        isFetchingRewardBalance,
    }
}
