import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseUnits, encodeFunctionData, erc20Abi } from 'viem'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import { PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, PEANUT_WALLET_CHAIN } from '@/constants'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { TRANSACTIONS } from '@/constants/query.consts'

type SendMoneyParams = {
    toAddress: Address
    amountInUsd: string
}

type UserOpEncodedParams = {
    to: Hex
    value?: bigint | undefined
    data?: Hex | undefined
}

type UseSendMoneyOptions = {
    address?: Address
    handleSendUserOpEncoded: (
        calls: UserOpEncodedParams[],
        chainId: string
    ) => Promise<{ userOpHash: Hash; receipt: TransactionReceipt | null }>
}

/**
 * Hook for sending money with optimistic updates
 *
 * Features:
 * - Optimistic balance update (instant UI feedback)
 * - Automatic balance refresh after transaction
 * - Automatic history refresh after transaction
 * - Rollback on error
 */
export const useSendMoney = ({ address, handleSendUserOpEncoded }: UseSendMoneyOptions) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ toAddress, amountInUsd }: SendMoneyParams) => {
            const amountToSend = parseUnits(amountInUsd, PEANUT_WALLET_TOKEN_DECIMALS)

            const txData = encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [toAddress, amountToSend],
            }) as Hex

            const params: UserOpEncodedParams[] = [
                {
                    to: PEANUT_WALLET_TOKEN as Hex,
                    value: 0n,
                    data: txData,
                },
            ]

            const result = await handleSendUserOpEncoded(params, PEANUT_WALLET_CHAIN.id.toString())
            return { userOpHash: result.userOpHash, amount: amountToSend, receipt: result.receipt }
        },

        // Optimistic update BEFORE transaction is sent
        onMutate: async ({ amountInUsd }) => {
            if (!address) return

            const amountToSend = parseUnits(amountInUsd, PEANUT_WALLET_TOKEN_DECIMALS)

            // Cancel any outgoing balance queries to avoid race conditions
            await queryClient.cancelQueries({ queryKey: ['balance', address] })

            // Snapshot the previous balance for rollback
            const previousBalance = queryClient.getQueryData<bigint>(['balance', address])

            // Optimistically update balance (only if sufficient balance)
            if (previousBalance !== undefined) {
                // Check for sufficient balance to prevent underflow
                if (previousBalance >= amountToSend) {
                    queryClient.setQueryData<bigint>(['balance', address], previousBalance - amountToSend)
                } else {
                    console.warn('[useSendMoney] Insufficient balance for optimistic update')
                    // Don't update optimistically, let transaction fail naturally
                }
            }

            return { previousBalance }
        },

        // On success, refresh real data from blockchain
        onSuccess: () => {
            // Invalidate balance to fetch real value
            queryClient.invalidateQueries({ queryKey: ['balance', address] })

            // Invalidate transaction history to show new transaction
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

            console.log('[useSendMoney] Transaction successful, refreshing balance and history')
        },

        // On error, rollback optimistic update
        onError: (error, variables, context) => {
            if (!address || !context) return

            // Rollback to previous balance
            if (context.previousBalance !== undefined) {
                queryClient.setQueryData(['balance', address], context.previousBalance)
            }

            console.error('[useSendMoney] Transaction failed, rolled back balance:', error)
        },
    })
}
