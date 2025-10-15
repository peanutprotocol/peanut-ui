'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, peanutPublicClient } from '@/constants'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useEffect, useState } from 'react'
import type { Hex, Address } from 'viem'
import { erc20Abi, parseUnits, encodeFunctionData } from 'viem'
import { useZeroDev } from '../useZeroDev'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const [isFetchingBalance, setIsFetchingBalance] = useState(true)
    const { balance } = useWalletStore()
    const { user } = useAuth()

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
            return await handleSendUserOpEncoded(params, chainId)
        },
        [handleSendUserOpEncoded]
    )

    const fetchBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch balance, address is undefined.')
            return
        }

        const userAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier

        if (userAddress?.toLowerCase() !== address.toLowerCase()) {
            console.warn('Skipping fetch balance, address is not the same as the user address.')
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
    }, [address, dispatch, user])

    useEffect(() => {
        if (!address) return
        fetchBalance()
    }, [address, fetchBalance])

    return {
        address: address!,
        balance: balance !== undefined ? BigInt(balance) : undefined,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        fetchBalance,
        isFetchingBalance,
    }
}
