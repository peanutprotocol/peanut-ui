'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { chargesApi } from '@/services/charges'
import { getRoute } from '@/services/swap'
import { CreateChargeRequest, PaymentCreationResponse, TRequestChargeResponse } from '@/services/services.types'
import { ErrorHandler, isNativeCurrency } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useState } from 'react'
import { parseUnits } from 'viem'
import type { Address, TransactionReceipt } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain, useAccount } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import type { AddMoneyPayload, BasePaymentResult } from './types'

/**
 * Hook for handling add money flow (External wallet → Peanut wallet)
 *
 * This flow handles:
 * 1. Create charge for deposit
 * 2. Get cross-chain route if needed
 * 3. Execute transactions via external wallet
 * 4. Create payment record
 *
 * Supports cross-chain deposits and different tokens.
 */
export const useAddMoneyFlow = () => {
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

    const addMoney = useCallback(
        async (payload: AddMoneyPayload): Promise<BasePaymentResult> => {
            if (!wagmiAddress) {
                return { success: false, error: 'External wallet not connected' }
            }

            setIsProcessing(true)
            setError(null)

            try {
                console.log('🚀 Starting add money flow:', payload)

                // 1. Create charge for deposit
                const createChargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: {
                        amount: payload.tokenAmount,
                        currency: 'USD',
                    },
                    baseUrl: window.location.origin,
                    requestProps: {
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        tokenAmount: payload.tokenAmount,
                        tokenAddress: PEANUT_WALLET_TOKEN,
                        tokenType: peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: 'USDC',
                        tokenDecimals: 6,
                        recipientAddress: wagmiAddress, // User's own Peanut wallet
                    },
                    transactionType: 'DEPOSIT',
                }

                // Add attachment if present
                if (payload.attachmentOptions?.rawFile) {
                    createChargePayload.attachment = payload.attachmentOptions.rawFile
                    createChargePayload.filename = payload.attachmentOptions.rawFile.name
                    createChargePayload.mimeType = payload.attachmentOptions.rawFile.type
                }
                if (payload.attachmentOptions?.message) {
                    createChargePayload.reference = payload.attachmentOptions.message
                }

                console.log('📝 Creating charge for add money:', createChargePayload)
                const charge = await chargesApi.create(createChargePayload)

                if (!charge.data.id) {
                    throw new Error('Charge created but UUID is missing')
                }

                const fullChargeDetails = await chargesApi.get(charge.data.id)
                setChargeDetails(fullChargeDetails)

                // 2. Check if cross-chain route is needed
                const isXChain = payload.fromChainId !== PEANUT_WALLET_CHAIN.id.toString()
                const isDiffToken = payload.fromTokenAddress.toLowerCase() !== PEANUT_WALLET_TOKEN.toLowerCase()

                let transactions: Array<{ to: Address; data: string; value: bigint }> = []
                let feeCostsUsd = 0

                if (isXChain || isDiffToken) {
                    console.log('🔄 Cross-chain/token swap needed, getting route...')
                    setIsPreparingRoute(true)

                    const route = await getRoute({
                        from: {
                            address: wagmiAddress,
                            tokenAddress: payload.fromTokenAddress as Address,
                            chainId: payload.fromChainId,
                        },
                        to: {
                            address: wagmiAddress,
                            tokenAddress: PEANUT_WALLET_TOKEN as Address,
                            chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        },
                        toAmount: parseUnits(payload.tokenAmount, 6), // USDC has 6 decimals
                    })

                    transactions = route.transactions.map((tx) => ({
                        to: tx.to,
                        data: tx.data,
                        value: BigInt(tx.value),
                    }))
                    feeCostsUsd = route.feeCostsUsd
                    setEstimatedFees(feeCostsUsd)
                    setIsPreparingRoute(false)
                } else {
                    // Same chain, same token - simple transfer
                    const transferData = isNativeCurrency(payload.fromTokenAddress)
                        ? '0x' // Native token transfer
                        : '0x' // ERC20 transfer (would need proper encoding)

                    transactions = [
                        {
                            to: PEANUT_WALLET_TOKEN as Address,
                            data: transferData,
                            value: isNativeCurrency(payload.fromTokenAddress)
                                ? parseUnits(payload.tokenAmount, 18)
                                : 0n,
                        },
                    ]
                }

                // 3. Switch network if needed
                const sourceChainId = Number(payload.fromChainId)
                if (connectedChain?.id !== sourceChainId) {
                    console.log(`🔄 Switching network to ${sourceChainId}`)
                    await switchChainAsync({ chainId: sourceChainId })
                }

                // 4. Execute transactions
                console.log(`💸 Executing ${transactions.length} transaction(s)...`)
                let finalReceipt: TransactionReceipt | null = null

                for (let i = 0; i < transactions.length; i++) {
                    const tx = transactions[i]
                    console.log(`📤 Sending transaction ${i + 1}/${transactions.length}`)

                    const hash = await sendTransactionAsync({
                        to: tx.to,
                        data: tx.data as `0x${string}`,
                        value: tx.value,
                        chainId: sourceChainId,
                    })

                    const receipt = await waitForTransactionReceipt(config, {
                        hash,
                        chainId: sourceChainId,
                        confirmations: 1,
                    })

                    finalReceipt = receipt
                    console.log(`✅ Transaction ${i + 1} confirmed:`, hash)
                }

                if (!finalReceipt?.transactionHash) {
                    throw new Error('Transaction failed or receipt missing')
                }

                setTransactionHash(finalReceipt.transactionHash)

                // 5. Create payment record
                console.log('📊 Creating payment record...')
                const payment = await chargesApi.createPayment({
                    chargeId: fullChargeDetails.uuid,
                    chainId: payload.fromChainId,
                    hash: finalReceipt.transactionHash,
                    tokenAddress: payload.fromTokenAddress,
                    payerAddress: wagmiAddress,
                })

                setPaymentDetails(payment)
                console.log('🎉 Add money flow completed successfully!')

                return {
                    success: true,
                    charge: fullChargeDetails,
                    payment,
                    txHash: finalReceipt.transactionHash,
                }
            } catch (err) {
                console.error('❌ Add money flow failed:', err)
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
        [wagmiAddress, sendTransactionAsync, switchChainAsync, connectedChain, config]
    )

    return {
        // Main action
        addMoney,

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
