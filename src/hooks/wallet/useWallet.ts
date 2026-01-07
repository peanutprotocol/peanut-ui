'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useEffect, useMemo } from 'react'
import { formatUnits, type Hex, type Address } from 'viem'
import { useZeroDev } from '../useZeroDev'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useBalance } from './useBalance'
import { useSendMoney as useSendMoneyMutation } from './useSendMoney'
import { formatCurrency } from '@/utils/general.utils'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const { balance: reduxBalance } = useWalletStore()
    const { user } = useAuth()

    // check if address matches user's wallet address
    const userAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier

    // only fetch balance if both address and userAddress are defined AND they match
    const isAddressReady = !!address && !!userAddress && userAddress.toLowerCase() === address.toLowerCase()

    // Use TanStack Query for auto-refreshing balance
    // only fetch balance when the validated address is ready
    const shouldFetchBalance = isAddressReady
    const {
        data: balanceFromQuery,
        isLoading: isFetchingBalance,
        refetch: refetchBalance,
    } = useBalance(shouldFetchBalance ? (address as Address) : undefined)

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
    // now it just triggers a refetch of the tanstack query
    const fetchBalance = useCallback(async () => {
        // guard: need a validated, matching address before fetching
        if (!isAddressReady) {
            console.warn('Skipping fetch balance, wallet address not ready or does not match user address.')
            return
        }

        await refetchBalance()
    }, [isAddressReady, refetchBalance])

    // Use balance from query if available, otherwise fall back to Redux
    const balance =
        balanceFromQuery !== undefined
            ? balanceFromQuery
            : reduxBalance !== undefined
              ? BigInt(reduxBalance)
              : undefined

    // consider balance as fetching until: address is validated and query has resolved
    const isBalanceLoading = !isAddressReady || isFetchingBalance

    // formatted balance for display (e.g. "1,234.56")
    const formattedBalance = useMemo(() => {
        if (balance === undefined) return '0.00'
        return formatCurrency(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [balance])

    // check if wallet has sufficient balance for a given usd amount
    const hasSufficientBalance = useCallback(
        (amountUsd: string | number): boolean => {
            if (balance === undefined) return false
            const amount = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd
            if (isNaN(amount) || amount < 0) return false
            const amountInWei = BigInt(Math.floor(amount * 10 ** PEANUT_WALLET_TOKEN_DECIMALS))
            return balance >= amountInWei
        },
        [balance]
    )

    return {
        address: isAddressReady ? address : undefined, // populate address only if it is validated and matches the user's wallet address
        balance,
        formattedBalance,
        hasSufficientBalance,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        fetchBalance,
        isFetchingBalance: isBalanceLoading,
    }
}
