'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { getRoute } from '@/services/swap'
import { PaymentCreationResponse, TRequestChargeResponse } from '@/services/services.types'
import { ErrorHandler, areEvmAddressesEqual } from '@/utils'
import { useCallback, useState } from 'react'
import { parseUnits } from 'viem'
import type { Address, TransactionReceipt } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain, useAccount } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import type { RequestPayPayload, BasePaymentResult } from './types'

/**
 * Hook for handling request payment flow (fulfilling payment requests)
 *
 * This flow handles:
 * 1. Get/create charge for request
 * 2. Determine wallet type (Peanut vs External)
 * 3. Get cross-chain route if needed
 * 4. Execute transactions via appropriate wallet
 * 5. Create payment record
 *
 * Supports both Peanut wallet and external wallet payments, with cross-chain capability.
 */
export const useRequestPayFlow = () => {
    const { sendMoney, sendTransactions, address: peanutWalletAddress, isConnected: isPeanutWallet } = useWallet()
    const { sendTransactionAsync } = useSendTransaction()
    const { switchChainAsync } = useSwitchChain()
    const { address: wagmiAddress, chain: connectedChain } = useAccount()
    const config = useConfig()

    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [chargeDetails, setChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)
    const [isPreparingRoute, setIsPreparingRoute] = useState(false)
    const [estimatedFees, setEstimatedFees] = useState<number | undefined>(undefined)

    const reset = useCallback(() => {
        setError(null)
        setChargeDetails(null)
        setPaymentDetails(null)
        setTransactionHash(null)
        setIsPreparingRoute(false)
        setEstimatedFees(undefined)
    }, [])

    const payRequest = useCallback(
        async (payload: RequestPayPayload): Promise<BasePaymentResult> => {
            const activeWalletAddress = isPeanutWallet ? peanutWalletAddress : wagmiAddress

            if (!activeWalletAddress) {
                return { success: false, error: 'No wallet connected' }
            }

            setIsProcessing(true)
            setError(null)

            try {
                console.log('🚀 Starting request payment flow:', payload)

                // 1. Get charge details (should already exist for requests)
                let fullChargeDetails: TRequestChargeResponse

                if (payload.chargeId) {
                    console.log('📋 Fetching existing charge:', payload.chargeId)
                    fullChargeDetails = await chargesApi.get(payload.chargeId)
                } else {
                    throw new Error('Request payment requires a charge ID')
                }

                setChargeDetails(fullChargeDetails)

                // 2. Determine if cross-chain/cross-token is needed
                const targetChainId = fullChargeDetails.chainId
                const targetTokenAddress = fullChargeDetails.tokenAddress

                // For Peanut wallet, we're always sending from PEANUT_WALLET_CHAIN/PEANUT_WALLET_TOKEN
                // For external wallet, we need to determine the source chain/token
                const sourceChainId = isPeanutWallet
                    ? PEANUT_WALLET_CHAIN.id.toString()
                    : connectedChain?.id.toString() || '1' // Default to mainnet if unknown

                const sourceTokenAddress = isPeanutWallet ? PEANUT_WALLET_TOKEN : targetTokenAddress // For external wallet, assume same token for now

                const isXChain = sourceChainId !== targetChainId
                const isDiffToken = !areEvmAddressesEqual(sourceTokenAddress, targetTokenAddress)

                let transactions: Array<{ to: Address; data: string; value: bigint }> = []
                let feeCostsUsd = 0
                let receipt: TransactionReceipt

                // 3. Handle cross-chain/cross-token scenarios
                if (isXChain || isDiffToken) {
                    console.log('🔄 Cross-chain/token payment needed, getting route...')
                    setIsPreparingRoute(true)

                    const route = await getRoute({
                        from: {
                            address: activeWalletAddress as Address,
                            tokenAddress: sourceTokenAddress as Address,
                            chainId: sourceChainId,
                        },
                        to: {
                            address: fullChargeDetails.requestLink.recipientAddress as Address,
                            tokenAddress: targetTokenAddress as Address,
                            chainId: targetChainId,
                        },
                        toAmount: parseUnits(fullChargeDetails.tokenAmount, fullChargeDetails.tokenDecimals),
                    })

                    transactions = route.transactions.map((tx) => ({
                        to: tx.to,
                        data: tx.data,
                        value: BigInt(tx.value),
                    }))
                    feeCostsUsd = route.feeCostsUsd
                    setEstimatedFees(feeCostsUsd)
                    setIsPreparingRoute(false)

                    // 4a. Execute cross-chain transactions
                    if (isPeanutWallet) {
                        console.log('💸 Executing cross-chain via Peanut wallet...')
                        receipt = await sendTransactions(
                            transactions.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value })),
                            sourceChainId
                        )
                    } else {
                        console.log('💸 Executing cross-chain via external wallet...')

                        // Switch network if needed
                        if (connectedChain?.id !== Number(sourceChainId)) {
                            await switchChainAsync({ chainId: Number(sourceChainId) })
                        }

                        // Execute transactions sequentially
                        let finalReceipt: TransactionReceipt | null = null
                        for (let i = 0; i < transactions.length; i++) {
                            const tx = transactions[i]
                            const hash = await sendTransactionAsync({
                                to: tx.to,
                                data: tx.data as `0x${string}`,
                                value: tx.value,
                                chainId: Number(sourceChainId),
                            })

                            finalReceipt = await waitForTransactionReceipt(config, {
                                hash,
                                chainId: Number(sourceChainId),
                                confirmations: 1,
                            })
                        }
                        receipt = finalReceipt!
                    }
                } else {
                    // 4b. Handle same-chain, same-token payments
                    if (isPeanutWallet && areEvmAddressesEqual(sourceTokenAddress, PEANUT_WALLET_TOKEN)) {
                        console.log('💸 Simple USDC transfer via Peanut wallet...')
                        receipt = await sendMoney(
                            fullChargeDetails.requestLink.recipientAddress as Address,
                            fullChargeDetails.tokenAmount
                        )
                    } else {
                        throw new Error('Same-chain external wallet payments not yet implemented')
                    }
                }

                if (!receipt || !receipt.transactionHash) {
                    throw new Error('Payment transaction failed or receipt missing')
                }

                setTransactionHash(receipt.transactionHash)
                console.log('✅ Payment transaction successful:', receipt.transactionHash)

                // 5. Create payment record
                console.log('📊 Creating payment record...')
                const payment = await chargesApi.createPayment({
                    chargeId: fullChargeDetails.uuid,
                    chainId: sourceChainId,
                    hash: receipt.transactionHash,
                    tokenAddress: sourceTokenAddress,
                    payerAddress: activeWalletAddress,
                })

                setPaymentDetails(payment)
                console.log('🎉 Request payment flow completed successfully!')

                return {
                    success: true,
                    charge: fullChargeDetails,
                    payment,
                    txHash: receipt.transactionHash,
                }
            } catch (err) {
                console.error('❌ Request payment flow failed:', err)
                const errorMessage = ErrorHandler(err)
                setError(errorMessage)

                return {
                    success: false,
                    error: errorMessage,
                }
            } finally {
                setIsProcessing(false)
                setIsPreparingRoute(false)
            }
        },
        [
            isPeanutWallet,
            peanutWalletAddress,
            wagmiAddress,
            sendMoney,
            sendTransactions,
            sendTransactionAsync,
            switchChainAsync,
            connectedChain,
            config,
        ]
    )

    return {
        // Main action
        payRequest,

        // State
        isProcessing,
        isPreparingRoute,
        error,
        chargeDetails,
        paymentDetails,
        transactionHash,
        estimatedFees,

        // Utilities
        reset,
    }
}
