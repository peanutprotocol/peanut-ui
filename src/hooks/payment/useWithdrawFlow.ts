'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { getRoute } from '@/services/swap'
import {
    CreateChargeRequest,
    CreateRequestRequest,
    PaymentCreationResponse,
    TRequestChargeResponse,
} from '@/services/services.types'
import { ErrorHandler, NATIVE_TOKEN_ADDRESS } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useState } from 'react'
// import { parseUnits } from 'viem' // Will be used for token amount calculations
import type { Address } from 'viem'
import type { WithdrawPayload, BasePaymentResult } from './types'

/**
 * Hook for handling withdraw flow (Peanut wallet → External address)
 *
 * This flow handles:
 * 1. Create request for withdrawal
 * 2. Create charge for the request
 * 3. Get cross-chain route if needed
 * 4. Execute transactions via Peanut wallet
 * 5. Create payment record
 *
 * Unifies the currently separate withdraw logic and supports cross-chain withdrawals.
 */
export const useWithdrawFlow = () => {
    const { sendTransactions, address: peanutWalletAddress } = useWallet()

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

    const withdraw = useCallback(
        async (payload: WithdrawPayload): Promise<BasePaymentResult> => {
            if (!peanutWalletAddress) {
                return { success: false, error: 'Peanut wallet not connected' }
            }

            setIsProcessing(true)
            setError(null)

            try {
                console.log('🚀 Starting withdraw flow:', payload)

                // 1. Create request for withdrawal (following current withdraw flow pattern)
                const requestPayload: CreateRequestRequest = {
                    recipientAddress: payload.recipient.resolvedAddress,
                    chainId: payload.toChainId,
                    tokenAddress: payload.toTokenAddress,
                    tokenType: String(
                        payload.toTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                            ? peanutInterfaces.EPeanutLinkType.native
                            : peanutInterfaces.EPeanutLinkType.erc20
                    ),
                    tokenAmount: payload.tokenAmount,
                    tokenDecimals: '6', // Assuming USDC decimals for now
                    tokenSymbol: 'USDC', // Will be dynamic in future
                }

                console.log('📝 Creating withdrawal request:', requestPayload)
                const request = await requestsApi.create(requestPayload)

                if (!request || !request.uuid) {
                    throw new Error('Failed to create request for withdrawal')
                }

                // 2. Create charge for the request
                const chargePayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: { amount: payload.tokenAmount, currency: 'USD' },
                    baseUrl: window.location.origin,
                    requestId: request.uuid,
                    requestProps: {
                        chainId: payload.toChainId,
                        tokenAmount: payload.tokenAmount,
                        tokenAddress: payload.toTokenAddress,
                        tokenType:
                            payload.toTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                                ? peanutInterfaces.EPeanutLinkType.native
                                : peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: 'USDC', // Will be dynamic in future
                        tokenDecimals: 6,
                        recipientAddress: payload.recipient.resolvedAddress,
                    },
                    transactionType: 'WITHDRAW',
                }

                console.log('📝 Creating withdrawal charge:', chargePayload)
                const charge = await chargesApi.create(chargePayload)

                if (!charge || !charge.data || !charge.data.id) {
                    throw new Error('Failed to create charge for withdrawal')
                }

                const fullChargeDetails = await chargesApi.get(charge.data.id)
                setChargeDetails(fullChargeDetails)

                // 3. Check if cross-chain route is needed
                const isXChain = PEANUT_WALLET_CHAIN.id.toString() !== payload.toChainId
                const isDiffToken = PEANUT_WALLET_TOKEN.toLowerCase() !== payload.toTokenAddress.toLowerCase()

                let transactions: Array<{ to: Address; data: string; value: bigint }> = []
                let feeCostsUsd = 0

                if (isXChain || isDiffToken) {
                    console.log('🔄 Cross-chain/token swap needed, getting route...')
                    setIsPreparingRoute(true)

                    const route = await getRoute({
                        from: {
                            address: peanutWalletAddress as Address,
                            tokenAddress: PEANUT_WALLET_TOKEN as Address,
                            chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        },
                        to: {
                            address: payload.recipient.resolvedAddress as Address,
                            tokenAddress: payload.toTokenAddress as Address,
                            chainId: payload.toChainId,
                        },
                        fromUsd: payload.tokenAmount, // Use USD amount for optimal routing
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
                    // Same chain, same token - use simple transfer
                    // This would be handled by the Peanut SDK transaction preparation
                    console.log('💸 Same chain/token withdrawal - preparing simple transfer')
                    // For now, we'll let the sendTransactions handle this
                    transactions = [] // Will be prepared by sendTransactions if empty
                }

                // 4. Execute transactions via Peanut wallet
                console.log('💸 Executing withdrawal transactions...')
                const receipt = await sendTransactions(
                    transactions.length > 0
                        ? transactions.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value }))
                        : [
                              {
                                  to: payload.recipient.resolvedAddress as Address,
                                  data: '0x', // Simple transfer, will be handled by sendTransactions
                                  value: 0n,
                              },
                          ],
                    PEANUT_WALLET_CHAIN.id.toString()
                )

                if (!receipt || !receipt.transactionHash) {
                    throw new Error('Withdrawal transaction failed or receipt missing')
                }

                setTransactionHash(receipt.transactionHash)
                console.log('✅ Withdrawal transaction successful:', receipt.transactionHash)

                // 5. Create payment record
                console.log('📊 Creating payment record...')
                const payment = await chargesApi.createPayment({
                    chargeId: fullChargeDetails.uuid,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    hash: receipt.transactionHash,
                    tokenAddress: PEANUT_WALLET_TOKEN,
                    payerAddress: peanutWalletAddress,
                })

                setPaymentDetails(payment)
                console.log('🎉 Withdraw flow completed successfully!')

                return {
                    success: true,
                    charge: fullChargeDetails,
                    payment,
                    txHash: receipt.transactionHash,
                }
            } catch (err) {
                console.error('❌ Withdraw flow failed:', err)
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
        [peanutWalletAddress, sendTransactions]
    )

    return {
        // Main action
        withdraw,

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
