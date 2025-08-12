'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { chargesApi } from '@/services/charges'
import { getRoute } from '@/services/swap'
import { TRequestChargeResponse, CreateChargeRequest } from '@/services/services.types'
import { ErrorHandler, areEvmAddressesEqual, getTokenDetails, NATIVE_TOKEN_ADDRESS } from '@/utils'
import { useCallback, useState, useContext } from 'react'
import { parseUnits } from 'viem'
import type { Address, TransactionReceipt } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain, useAccount } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tokenSelectorContext } from '@/context'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import type { RequestPayPayload, BasePaymentResult } from './types'

/**
 * Hook for handling request payment flow (fulfilling payment requests)
 *
 * Modernized with TanStack Query for:
 * - Automatic caching and deduplication
 * - Built-in retry logic and error handling
 * - Race condition elimination
 * - Better loading states and UX
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
export const useRequestPayFlow = (chargeId?: string) => {
    const { sendMoney, sendTransactions, address: peanutWalletAddress, isConnected: isPeanutWallet } = useWallet()
    const { sendTransactionAsync } = useSendTransaction()
    const { switchChainAsync } = useSwitchChain()
    const { address: wagmiAddress, chain: connectedChain } = useAccount()
    const config = useConfig()
    const queryClient = useQueryClient()

    // Get selected token context for external wallets
    const { selectedTokenAddress, selectedChainID } = useContext(tokenSelectorContext)

    // Local state for transaction execution
    const [transactionHash, setTransactionHash] = useState<string | null>(null)

    // TanStack Query for charge details fetching
    const chargeQuery = useQuery({
        queryKey: ['charge-details', chargeId],
        queryFn: () => chargesApi.get(chargeId!),
        enabled: !!chargeId,
        staleTime: 30000, // 30 seconds
        retry: 3,
    })

    // TanStack Query for route preparation
    const routeQuery = useQuery({
        queryKey: [
            'request-pay-route',
            chargeQuery.data,
            isPeanutWallet,
            connectedChain?.id,
            selectedTokenAddress,
            selectedChainID,
        ],
        queryFn: async () => {
            const charge = chargeQuery.data!
            const activeWalletAddress = isPeanutWallet ? peanutWalletAddress : wagmiAddress

            if (!activeWalletAddress) {
                throw new Error('No wallet connected')
            }

            const targetChainId = charge.chainId
            const targetTokenAddress = charge.tokenAddress

            // For Peanut wallet, we're always sending from PEANUT_WALLET_CHAIN/PEANUT_WALLET_TOKEN
            // For external wallets, use selected token/chain from TokenSelector
            const sourceChainId = isPeanutWallet
                ? PEANUT_WALLET_CHAIN.id.toString()
                : selectedChainID || connectedChain?.id.toString() || '1'

            const sourceTokenAddress = isPeanutWallet ? PEANUT_WALLET_TOKEN : selectedTokenAddress || targetTokenAddress

            const isXChain = sourceChainId !== targetChainId
            const isDiffToken = !areEvmAddressesEqual(sourceTokenAddress, targetTokenAddress)

            // Only get route if cross-chain/cross-token is needed
            if (!isXChain && !isDiffToken) {
                return null
            }



            return await getRoute({
                from: {
                    address: activeWalletAddress as Address,
                    tokenAddress: sourceTokenAddress as Address,
                    chainId: sourceChainId,
                },
                to: {
                    address: charge.requestLink.recipientAddress as Address,
                    tokenAddress: targetTokenAddress as Address,
                    chainId: targetChainId,
                },
                toAmount: parseUnits(charge.tokenAmount, charge.tokenDecimals),
            })
        },
        enabled:
            !!chargeQuery.data &&
            (!!peanutWalletAddress || !!wagmiAddress) &&
            // For external wallets, wait for token selection
            (isPeanutWallet || (!!selectedTokenAddress && !!selectedChainID)),
        staleTime: 60000, // 1 minute
        retry: 2,
    })

    const reset = useCallback(() => {
        setTransactionHash(null)
        queryClient.removeQueries({ queryKey: ['request-pay-route'] })
    }, [queryClient])

    // Separate charge creation function for dynamic scenarios
    const createCharge = useCallback(
        async (payload: RequestPayPayload): Promise<TRequestChargeResponse> => {
            if (!payload.recipient || !payload.selectedTokenAddress || !payload.selectedChainID) {
                throw new Error('Missing required data for charge creation')
            }

        // Get token details for the target token
        const tokenDetails = getTokenDetails({
                tokenAddress: payload.selectedTokenAddress as Address,
                chainId: payload.selectedChainID,
            })

            if (!tokenDetails) {
                throw new Error('Unable to get token details for payment')
            }

            const tokenType =
                payload.selectedTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20

            // Create charge for dynamic payment
            const chargePayload: CreateChargeRequest = {
                pricing_type: 'fixed_price',
                local_price: { amount: payload.tokenAmount, currency: 'USD' },
                baseUrl: window.location.origin,
                requestProps: {
                    chainId: payload.selectedChainID,
                    tokenAmount: payload.tokenAmount,
                    tokenAddress: payload.selectedTokenAddress,
                    tokenType: tokenType,
                    tokenSymbol: tokenDetails.symbol,
                    tokenDecimals: tokenDetails.decimals,
                    recipientAddress: payload.recipient.resolvedAddress,
                },
                transactionType: 'REQUEST',
            }

            const charge = await chargesApi.create(chargePayload)

            if (!charge || !charge.data || !charge.data.id) {
                throw new Error('Failed to create charge for payment or charge ID missing.')
            }

            const fullChargeDetails = await chargesApi.get(charge.data.id)

            // Update the query cache with the new charge
            queryClient.setQueryData(['charge-details', fullChargeDetails.uuid], fullChargeDetails)

            return fullChargeDetails
        },
        [queryClient]
    )

    // TanStack Query mutation for payment execution
    const paymentMutation = useMutation({
        mutationFn: async (payload: RequestPayPayload): Promise<BasePaymentResult> => {
            const activeWalletAddress = isPeanutWallet ? peanutWalletAddress : wagmiAddress

            if (!activeWalletAddress) {
                throw new Error('No wallet connected')
            }

            // 1. Get charge details (should exist by now)
            let fullChargeDetails: TRequestChargeResponse

            if (payload.chargeId) {
                // Get charge from cache or API
                fullChargeDetails =
                    queryClient.getQueryData(['charge-details', payload.chargeId]) ||
                    (await chargesApi.get(payload.chargeId))
            } else {
                throw new Error(
                    'Request payment requires a charge ID - charge should be created before payment execution'
                )
            }

            // 2. Get route from cache or prepare new one
            const route = routeQuery.data

            // 3. Determine transaction parameters
            const targetChainId = fullChargeDetails.chainId
            const targetTokenAddress = fullChargeDetails.tokenAddress
            const sourceChainId = isPeanutWallet
                ? PEANUT_WALLET_CHAIN.id.toString()
                : selectedChainID || connectedChain?.id.toString() || '1'
            const sourceTokenAddress = isPeanutWallet ? PEANUT_WALLET_TOKEN : selectedTokenAddress || targetTokenAddress

            const isXChain = sourceChainId !== targetChainId
            const isDiffToken = !areEvmAddressesEqual(sourceTokenAddress, targetTokenAddress)

            let receipt: TransactionReceipt

            // 4. Execute transactions based on route type
            if (route && (isXChain || isDiffToken)) {

                const transactions = route.transactions.map((tx) => ({
                    to: tx.to,
                    data: tx.data,
                    value: BigInt(tx.value),
                }))

                if (isPeanutWallet) {
                    receipt = await sendTransactions(
                        transactions.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value })),
                        sourceChainId
                    )
                } else {
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
                // Same-chain, same-token payment
                if (isPeanutWallet && areEvmAddressesEqual(sourceTokenAddress, PEANUT_WALLET_TOKEN)) {
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

            // 5. Create payment record
            const payment = await chargesApi.createPayment({
                chargeId: fullChargeDetails.uuid,
                chainId: sourceChainId,
                hash: receipt.transactionHash,
                tokenAddress: sourceTokenAddress,
                payerAddress: activeWalletAddress,
            })

            return {
                success: true,
                charge: fullChargeDetails,
                payment,
                txHash: receipt.transactionHash,
            }
        },
        onError: (error) => {
            console.error('❌ Request payment flow failed:', error)
        },
    })

    const payRequest = useCallback(
        async (payload: RequestPayPayload): Promise<BasePaymentResult> => {
            try {
                return await paymentMutation.mutateAsync(payload)
            } catch (error) {
                const errorMessage = ErrorHandler(error)
                return {
                    success: false,
                    error: errorMessage,
                }
            }
        },
        [paymentMutation]
    )

    return {
        // Main actions
        payRequest,
        createCharge,

        // TanStack Query states
        isProcessing: paymentMutation.isPending,
        isPreparingRoute: routeQuery.isFetching,
        error: paymentMutation.error
            ? ErrorHandler(paymentMutation.error)
            : chargeQuery.error
              ? ErrorHandler(chargeQuery.error)
              : routeQuery.error
                ? ErrorHandler(routeQuery.error)
                : null,

        // Data from queries
        chargeDetails: chargeQuery.data,
        route: routeQuery.data,
        transactionHash,
        estimatedFees: routeQuery.data?.feeCostsUsd,

        // Loading states
        isLoadingCharge: chargeQuery.isLoading,
        isLoadingRoute: routeQuery.isLoading,

        // Query states for advanced usage
        chargeQuery,
        routeQuery,
        paymentMutation,

        // Utilities
        reset,
    }
}
