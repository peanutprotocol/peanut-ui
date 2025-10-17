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
import { useBalance } from './useBalance'
import { useSendMoney as useSendMoneyMutation } from './useSendMoney'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const { balance: reduxBalance } = useWalletStore()
    const { user } = useAuth()

    // Check if address matches user's wallet address
    const userAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
    const isValidAddress = !address || !userAddress || userAddress.toLowerCase() === address.toLowerCase()

    // Use TanStack Query for auto-refreshing balance
    const {
        data: balanceFromQuery,
        isLoading: isFetchingBalance,
        refetch: refetchBalance,
    } = useBalance(isValidAddress ? (address as Address | undefined) : undefined)

    // Sync TanStack Query balance with Redux (for backward compatibility)
    useEffect(() => {
        if (balanceFromQuery !== undefined) {
            dispatch(walletActions.setBalance(balanceFromQuery))
        }
    }, [balanceFromQuery, dispatch])

    // Mutation for sending money with optimistic updates
    const sendMoneyMutation = useSendMoneyMutation({ address: address as Address | undefined, handleSendUserOpEncoded })

    const sendMoney = useCallback(
        async (toAddress: Address, amountInUsd: string) => {
            // Use mutation which provides optimistic updates
            const result = await sendMoneyMutation.mutateAsync({ toAddress, amountInUsd })
            // Return full result for backward compatibility
            return { userOpHash: result.userOpHash, receipt: result.receipt }
        },
        [sendMoneyMutation]
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

    // Legacy fetchBalance function for backward compatibility
    // Now it just triggers a refetch of the TanStack Query
    const fetchBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch balance, address is undefined.')
            return
        }

        if (!isValidAddress) {
            console.warn('Skipping fetch balance, address is not the same as the user address.')
            return
        }

        await refetchBalance()
    }, [address, isValidAddress, refetchBalance])

    // Use balance from query if available, otherwise fall back to Redux
    const balance =
        balanceFromQuery !== undefined
            ? balanceFromQuery
            : reduxBalance !== undefined
              ? BigInt(reduxBalance)
              : undefined

    return {
        address,
        balance,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        fetchBalance,
        isFetchingBalance,
    }
}
