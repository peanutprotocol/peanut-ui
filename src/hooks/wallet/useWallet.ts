'use client'

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    peanutPublicClient,
    PINTA_WALLET_CHAIN,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    pintaPublicClient,
} from '@/constants'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { formatAmount } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useEffect } from 'react'
import type { Hex } from 'viem'
import { erc20Abi, formatUnits, getAddress } from 'viem'
import { useZeroDev } from '../useZeroDev'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const { balance } = useWalletStore()

    const sendTransactions = useCallback(
        async (unsignedTxs: peanutInterfaces.IPeanutUnsignedTransaction[]) => {
            if (!unsignedTxs || unsignedTxs.length === 0) {
                throw new Error('No transactions provided to send.')
            }

            // determine the target chain based on the recipient address of the first transaction.
            const firstTx = unsignedTxs[0]
            let targetChainId: string

            // normalize addresses for reliable comparison.
            const targetAddress = firstTx.to ? getAddress(firstTx.to as Hex) : null
            const pintaTokenAddress = getAddress(PINTA_WALLET_TOKEN as Hex)

            // if the target is the pinta token contract, use the polygon chain id.
            if (targetAddress === pintaTokenAddress) {
                targetChainId = PINTA_WALLET_CHAIN.id.toString()
            } else {
                // otherwise, assume it's a standard peanut transaction on arbitrum.
                targetChainId = PEANUT_WALLET_CHAIN.id.toString()
            }

            // format the transactions for the zerodev backend.
            const params = unsignedTxs.map((tx: peanutInterfaces.IPeanutUnsignedTransaction) => ({
                to: tx.to! as Hex,
                value: tx.value?.valueOf() ?? 0n,
                data: (tx.data as Hex | undefined) ?? '0x',
            }))

            // send the user operation(s) through the zerodev hook, specifying the target chain.
            const receipt = await handleSendUserOpEncoded(params, targetChainId)

            return receipt
        },
        [handleSendUserOpEncoded]
    )

    const fetchBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch balance, address is undefined.')
            return
        }
        const balance = await peanutPublicClient.readContract({
            address: PEANUT_WALLET_TOKEN,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Hex],
        })
        dispatch(walletActions.setBalance(balance))
    }, [address, dispatch])

    const getRewardWalletBalance = useCallback(async () => {
        if (!address) {
            console.warn('Cannot fetch reward balance, address is undefined.')
            return ''
        }
        const balance = await pintaPublicClient.readContract({
            address: PINTA_WALLET_TOKEN,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [getAddress(address)],
        })

        return formatAmount(formatUnits(balance, PINTA_WALLET_TOKEN_DECIMALS))
    }, [address])

    useEffect(() => {
        if (!address) {
            return
        }
        const fetchRewardsWalletBalance = async () => {
            const balance = await getRewardWalletBalance()
            dispatch(walletActions.setRewardWalletBalance(balance))
        }
        fetchBalance()
        fetchRewardsWalletBalance()
    }, [address, fetchBalance, getRewardWalletBalance, dispatch])

    return {
        address: address!,
        balance: BigInt(balance),
        isConnected: isKernelClientReady,
        sendTransactions,
        getRewardWalletBalance,
        fetchBalance,
    }
}
