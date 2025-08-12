'use client'

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    ROUTE_NOT_FOUND_ERROR,
    PEANUT_WALLET_TOKEN_DECIMALS,
} from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { getRoute, type PeanutCrossChainRoute } from '@/services/swap'
import { CreateChargeRequest, PaymentCreationResponse, TRequestChargeResponse } from '@/services/services.types'
import { ErrorHandler, NATIVE_TOKEN_ADDRESS, getTokenDetails, isStableCoin, formatAmount } from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useState, useMemo } from 'react'
import type { Address, TransactionReceipt } from 'viem'
import { formatUnits, parseUnits } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WithdrawPayload, BasePaymentResult } from './types'

/**
 * Route Query Hook - Uses TanStack Query for route fetching
 *
 * Handles:
 * - Automatic request deduplication
 * - Request cancellation on new queries
 * - Stale data management
 * - Built-in retry logic
 * - Cache invalidation for route refresh
 */
const useRouteQuery = (payload: WithdrawPayload | null, peanutWalletAddress: string | null) => {
    return useQuery({
        queryKey: ['crypto-withdraw-route', payload],
        queryFn: async (): Promise<PeanutCrossChainRoute | null> => {
            if (!payload || !peanutWalletAddress) return null

            const isXChain = PEANUT_WALLET_CHAIN.id.toString() !== payload.toChainId
            const isDiffToken = PEANUT_WALLET_TOKEN.toLowerCase() !== payload.toTokenAddress.toLowerCase()

            if (!isXChain && !isDiffToken) {
                return null // No route needed for same chain/token
            }

            console.log('Fetching cross-chain route for withdrawal...')

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
                fromAmount: parseUnits(payload.tokenAmount, PEANUT_WALLET_TOKEN_DECIMALS),
            })

            // RFQ validation for Peanut wallet flows
            if (route.type === 'swap') {
                console.warn('No RFQ route found for this token pair, only swap route available')
                throw new Error(ROUTE_NOT_FOUND_ERROR)
            }

            console.log('Cross-chain route fetched successfully:', {
                expiry: route.expiry,
                type: route.type,
                feeCostsUsd: route.feeCostsUsd,
            })

            return route
        },
        enabled: !!payload && !!peanutWalletAddress,
        staleTime: 30000, // Routes are fresh for 30 seconds
        gcTime: 60000, // Keep in cache for 1 minute
        retry: (failureCount, error) => {
            // Don't retry RFQ validation errors
            if (error instanceof Error && error.message === ROUTE_NOT_FOUND_ERROR) {
                return false
            }
            return failureCount < 2
        },
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnReconnect: true, // Do refetch on network reconnect
    })
}

/**
 * Enhanced Crypto Withdraw Flow Hook with TanStack Query
 *
 * This flow handles:
 * 1. Route preparation with TanStack Query (automatic caching, deduplication, cancellation)
 * 2. Create charge for the request
 * 3. Execute transactions via Peanut wallet
 * 4. Create payment record
 *
 * Features:
 * - Automatic route caching and deduplication
 * - Request cancellation prevents race conditions
 * - Stale data management with refresh capabilities
 * - Built-in retry logic for network failures
 * - Min received calculation from actual route data
 * - RFQ validation for Peanut wallet flows
 */
export const useCryptoWithdrawFlow = () => {
    const { sendTransactions, sendMoney, address: peanutWalletAddress } = useWallet()
    const queryClient = useQueryClient()

    // Core processing state (non-route related)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [chargeDetails, setChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)

    // Route preparation state - managed by TanStack Query
    const [currentPayload, setCurrentPayload] = useState<WithdrawPayload | null>(null)

    // Route query - handles all route fetching logic
    const {
        data: xChainRoute,
        isLoading: isPreparingRoute,
        error: routeQueryError,
        refetch: refetchRoute,
        isStale,
        isFetching,
    } = useRouteQuery(currentPayload, peanutWalletAddress)

    // Computed values
    const isCrossChain = !!xChainRoute
    const estimatedFees = xChainRoute?.feeCostsUsd || 0
    const routeExpiry = xChainRoute?.expiry
    const isRouteExpired = routeExpiry ? new Date(routeExpiry).getTime() < Date.now() : false
    const routeError = routeQueryError?.message || null

    // Min received calculation from actual route data
    const minReceived = useMemo(() => {
        if (!xChainRoute || !currentPayload) return null

        const tokenDetails = getTokenDetails({
            tokenAddress: currentPayload.toTokenAddress as Address,
            chainId: currentPayload.toChainId,
        })

        if (!tokenDetails) return null

        const minReceivedAmount = formatUnits(
            BigInt(xChainRoute.rawResponse.route.estimate.toAmountMin),
            tokenDetails.decimals
        )

        return isStableCoin(tokenDetails.symbol)
            ? `$ ${formatAmount(minReceivedAmount)}`
            : `${formatAmount(minReceivedAmount)} ${tokenDetails.symbol}`
    }, [xChainRoute, currentPayload])

    // Route preparation - just sets payload, TanStack Query handles the rest
    const prepareRoute = useCallback((payload: WithdrawPayload) => {
        console.log('Preparing route for withdrawal...', payload)
        setCurrentPayload(payload)
        setError(null) // Clear any previous errors
        return Promise.resolve(true) // Always succeeds immediately, query handles async
    }, [])

    // Route refresh - invalidate cache and refetch
    const refreshRoute = useCallback(async () => {
        if (!currentPayload) return

        console.log('Refreshing route due to expiry...')

        // Invalidate the query cache
        await queryClient.invalidateQueries({
            queryKey: ['crypto-withdraw-route', currentPayload],
        })

        // Trigger immediate refetch
        await refetchRoute()
    }, [currentPayload, queryClient, refetchRoute])

    // Withdraw method - uses cached route data
    const withdraw = useCallback(async (): Promise<BasePaymentResult> => {
        if (!peanutWalletAddress || !currentPayload) {
            return { success: false, error: 'Missing required data for withdrawal' }
        }

        // Validate route if cross-chain
        if (isCrossChain) {
            if (!xChainRoute) {
                return { success: false, error: 'Cross-chain route not prepared' }
            }

            if (isRouteExpired) {
                return { success: false, error: 'Route has expired. Please refresh and try again.' }
            }
        }

        setIsProcessing(true)
        setError(null)

        try {
            console.log('Starting withdrawal process with payload:', currentPayload)

            // Get token details for the target token
            const tokenDetails = getTokenDetails({
                tokenAddress: currentPayload.toTokenAddress as Address,
                chainId: currentPayload.toChainId,
            })

            if (!tokenDetails) {
                throw new Error('Unable to get token details for withdrawal')
            }

            const tokenType =
                currentPayload.toTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20

            // Create charge
            const chargePayload: CreateChargeRequest = {
                pricing_type: 'fixed_price',
                local_price: { amount: currentPayload.tokenAmount, currency: 'USD' },
                baseUrl: window.location.origin,
                requestProps: {
                    chainId: currentPayload.toChainId,
                    tokenAmount: currentPayload.tokenAmount,
                    tokenAddress: currentPayload.toTokenAddress,
                    tokenType: tokenType,
                    tokenSymbol: tokenDetails.symbol,
                    tokenDecimals: tokenDetails.decimals,
                    recipientAddress: currentPayload.recipient.resolvedAddress,
                },
                transactionType: 'WITHDRAW',
            }

            console.log('Creating charge with payload:', chargePayload)
            const charge = await chargesApi.create(chargePayload)

            if (!charge || !charge.data || !charge.data.id) {
                throw new Error('Failed to create charge for withdrawal or charge ID missing.')
            }

            const fullChargeDetails = await chargesApi.get(charge.data.id)
            setChargeDetails(fullChargeDetails)
            console.log('Charge created successfully:', fullChargeDetails.uuid)

            // Execute transaction
            let receipt: TransactionReceipt

            if (xChainRoute) {
                console.log('Executing cross-chain withdrawal with cached route')
                // Use cached route transactions
                const transactions = xChainRoute.transactions.map((tx) => ({
                    to: tx.to,
                    data: tx.data,
                    value: BigInt(tx.value),
                }))
                receipt = await sendTransactions(transactions)
            } else {
                console.log('Executing same-chain withdrawal')
                // Same chain/token - direct send
                receipt = await sendMoney(
                    currentPayload.recipient.resolvedAddress as Address,
                    currentPayload.tokenAmount
                )
            }

            if (!receipt || !receipt.transactionHash) {
                throw new Error('Withdrawal transaction failed or receipt missing')
            }

            console.log('Transaction successful:', receipt.transactionHash)
            setTransactionHash(receipt.transactionHash)

            // Create payment record
            const payment = await chargesApi.createPayment({
                chargeId: fullChargeDetails.uuid,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                hash: receipt.transactionHash,
                tokenAddress: PEANUT_WALLET_TOKEN,
                payerAddress: peanutWalletAddress,
            })

            setPaymentDetails(payment)
            console.log('Payment record created successfully')

            return {
                success: true,
                charge: fullChargeDetails,
                payment,
                txHash: receipt.transactionHash,
            }
        } catch (err) {
            console.error('Withdrawal failed:', err)
            const errorMessage = ErrorHandler(err)
            setError(errorMessage)

            return {
                success: false,
                error: errorMessage,
            }
        } finally {
            setIsProcessing(false)
        }
    }, [peanutWalletAddress, currentPayload, xChainRoute, isCrossChain, isRouteExpired, sendTransactions, sendMoney])

    const reset = useCallback(() => {
        setCurrentPayload(null)
        setError(null)
        setChargeDetails(null)
        setPaymentDetails(null)
        setTransactionHash(null)

        // Clear route cache
        queryClient.removeQueries({
            queryKey: ['crypto-withdraw-route'],
        })
    }, [queryClient])

    // Combined error state
    const displayError = useMemo(() => error || routeError, [error, routeError])

    return {
        // Main actions
        prepareRoute,
        refreshRoute,
        withdraw,
        reset,

        // Core state
        isProcessing,
        error,
        setError,
        chargeDetails,
        paymentDetails,
        transactionHash,

        // Route state (from TanStack Query)
        isPreparingRoute,
        xChainRoute,
        routeError,
        isRouteExpired,
        routeExpiry,
        isStale, // Indicates if route data might be outdated
        isFetching, // Indicates if query is currently fetching

        // Computed values
        isCrossChain,
        estimatedFees,
        minReceived,
        displayError,

        // Current payload for debugging and consistency
        currentPayload,
    }
}
