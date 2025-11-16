'use client'

import { useCallback } from 'react'
import { useKernelClient } from '@/context/kernelClient.context'
import { signUserOperation } from '@zerodev/sdk/actions'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    USER_OP_ENTRY_POINT,
} from '@/constants/zerodev.consts'
import { parseUnits, encodeFunctionData, erc20Abi, concat } from 'viem'
import type { Hex, Address } from 'viem'
import type { SignUserOperationReturnType } from '@zerodev/sdk/actions'
import { captureException } from '@sentry/nextjs'

export interface SignedUserOpData {
    signedUserOp: SignUserOperationReturnType
    chainId: string
    entryPointAddress: Address
}

/**
 * Hook to sign UserOperations without broadcasting them to the network.
 * This allows for a two-phase commit pattern where the transaction is signed first,
 * then submitted from the backend after confirming external dependencies (e.g., Manteca payment).
 */
export const useSignUserOp = () => {
    const { getClientForChain } = useKernelClient()

    /**
     * Signs a USDC transfer UserOperation without broadcasting it.
     *
     * @param toAddress - Recipient address
     * @param amountInUsd - Amount in USD (will be converted to USDC token decimals)
     * @param chainId - Chain ID (defaults to Peanut wallet chain)
     * @returns Signed UserOperation data ready for backend submission
     *
     * @throws Error if signing fails (e.g., user cancels, invalid parameters)
     */
    const signTransferUserOp = useCallback(
        async (
            toAddress: Address,
            amountInUsd: string,
            chainId: string = PEANUT_WALLET_CHAIN.id.toString()
        ): Promise<SignedUserOpData> => {
            try {
                const client = getClientForChain(chainId)

                // Ensure account is initialized
                if (!client.account) {
                    throw new Error('Smart account not initialized')
                }

                const { factory, factoryData } = await client.account.getFactoryArgs()
                const initCode = !!factory && factoryData ? concat([factory, factoryData]) : undefined

                // Parse amount to USDC decimals (6 decimals)
                const amount = parseUnits(amountInUsd.replace(/,/g, ''), PEANUT_WALLET_TOKEN_DECIMALS)

                // Encode USDC transfer function call
                const txData = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [toAddress, amount],
                }) as Hex

                // Build USDC transfer call (not native token transfer)
                const calls = [
                    {
                        to: PEANUT_WALLET_TOKEN as Hex, // USDC contract address
                        value: 0n, // No native token sent
                        data: txData, // Encoded transfer call
                    },
                ]

                // Sign the UserOperation (does NOT broadcast)
                // This fills in all required fields (gas, nonce, paymaster, signature)
                const signedUserOp = await signUserOperation(client, {
                    account: client.account,
                    callData: await client.account!.encodeCalls(calls),
                })
                signedUserOp.initCode = initCode

                // Return everything the backend needs to submit the UserOp
                return {
                    signedUserOp,
                    chainId,
                    entryPointAddress: USER_OP_ENTRY_POINT.address,
                }
            } catch (error) {
                console.error('[useSignUserOp] Error signing UserOperation:', error)
                captureException(error, {
                    tags: { feature: 'sign-user-op' },
                    extra: {
                        toAddress,
                        amountInUsd,
                        chainId,
                    },
                })
                throw error
            }
        },
        [getClientForChain]
    )

    return { signTransferUserOp }
}
