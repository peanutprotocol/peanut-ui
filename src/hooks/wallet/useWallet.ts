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
import { useCallback, useEffect, useState, useRef } from 'react'
import type { Hex, Address } from 'viem'
import { erc20Abi, formatUnits, parseUnits, encodeFunctionData, getAddress } from 'viem'
import { useZeroDev } from '../useZeroDev'

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { address, isKernelClientReady, handleSendUserOpEncoded } = useZeroDev()
    const [isFetchingBalance, setIsFetchingBalance] = useState(true)
    const [isFetchingRewardBalance, setIsFetchingRewardBalance] = useState(true)
    const { balance } = useWalletStore()
    const eventListenerRef = useRef<(() => void) | null>(null)
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
    const TIMEOUT_INTERVAL = 2000

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

    // Set up real-time balance monitoring via contract events
    const setupBalanceMonitoring = useCallback(() => {
        if (!address) return

        // Clean up previous event listener and retry timer
        eventListenerRef.current?.()
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current)
            retryTimerRef.current = null
        }

        try {
            // Create two separate watchers for incoming and outgoing transfers
            // Watch for incoming transfers (to: address)
            const watchIncoming = peanutPublicClient.watchContractEvent({
                address: PEANUT_WALLET_TOKEN,
                abi: erc20Abi,
                eventName: 'Transfer',
                args: {
                    to: address as `0x${string}`,
                },
                onLogs: () => {
                    fetchBalance()
                },
                onError: (error) => {
                    console.error('Contract event listener error (incoming):', error)
                    if (retryTimerRef.current) {
                        clearTimeout(retryTimerRef.current)
                    }
                    retryTimerRef.current = setTimeout(() => setupBalanceMonitoring(), TIMEOUT_INTERVAL)
                },
            })

            // Watch for outgoing transfers (from: address)
            const watchOutgoing = peanutPublicClient.watchContractEvent({
                address: PEANUT_WALLET_TOKEN,
                abi: erc20Abi,
                eventName: 'Transfer',
                args: {
                    from: address as `0x${string}`,
                },
                onLogs: () => {
                    fetchBalance()
                },
                onError: (error) => {
                    console.error('Contract event listener error (outgoing):', error)
                    if (retryTimerRef.current) {
                        clearTimeout(retryTimerRef.current)
                    }
                    retryTimerRef.current = setTimeout(() => setupBalanceMonitoring(), TIMEOUT_INTERVAL)
                },
            })

            // Store cleanup function that cleans up both watchers
            eventListenerRef.current = () => {
                watchIncoming()
                watchOutgoing()
            }
        } catch (error) {
            console.error('Failed to setup balance monitoring:', error)
        }
    }, [address, fetchBalance])

    useEffect(() => {
        if (!address) return

        // Initial balance fetch
        fetchBalance()
        getRewardWalletBalance()

        // Setup real-time monitoring
        setupBalanceMonitoring()

        // Cleanup on unmount or address change
        return () => {
            eventListenerRef.current?.()
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
        }
    }, [address, fetchBalance, getRewardWalletBalance, setupBalanceMonitoring])

    return {
        address: address!,
        balance: balance !== undefined ? BigInt(balance) : undefined,
        isConnected: isKernelClientReady,
        sendTransactions,
        sendMoney,
        getRewardWalletBalance,
        fetchBalance,
        isFetchingBalance,
        isFetchingRewardBalance,
    }
}
