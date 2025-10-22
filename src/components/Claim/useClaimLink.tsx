'use client'

import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import {
    generateKeysFromString,
    getParamsFromLink,
    getContractAddress,
    signWithdrawalMessage,
    createClaimXChainPayload,
} from '@squirrel-labs/peanut-sdk'
import { useContext, useMemo } from 'react'
import { useSwitchChain, useAccount } from 'wagmi'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureException } from '@sentry/nextjs'

import { next_proxy_url } from '@/constants'
import { CLAIM_LINK, CLAIM_LINK_XCHAIN, TRANSACTIONS } from '@/constants/query.consts'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { isTestnetChain } from '@/utils'
import { sendLinksApi, ESendLinkStatus } from '@/services/sendLinks'

// ============================================================================
// Constants
// ============================================================================

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to make POST requests with consistent error handling
 */
async function postJson<T>(url: string, body: Record<string, any>): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
        const errorMessage = typeof data === 'string' ? data : data.error || data.message || response.statusText
        throw new Error(errorMessage)
    }

    if (data.error) {
        throw new Error(data.error)
    }

    return data
}

/**
 * Creates the payload for claiming a link
 */
async function createClaimPayload(link: string, recipientAddress: string, onlyRecipientMode?: boolean) {
    const params = getParamsFromLink(link)
    const password = params.password
    const keys = generateKeysFromString(password) // deterministically generate keys from password

    // cryptography - sign the withdrawal message
    const claimParams = await signWithdrawalMessage(
        params.contractVersion,
        params.chainId,
        getContractAddress(params.chainId, params.contractVersion),
        params.depositIdx,
        recipientAddress,
        keys.privateKey,
        onlyRecipientMode
    )

    return {
        claimParams,
        chainId: params.chainId,
        contractVersion: params.contractVersion,
    }
}

/**
 * Claims a link through the Peanut API
 */
async function executeClaim({
    link,
    recipientAddress,
    depositDetails,
    baseUrl = `${next_proxy_url}/claim-v3`,
}: {
    link: string
    recipientAddress: string
    depositDetails?: {
        pubKey20: string
        amount: string
        tokenAddress: string
        contractType: number
        claimed: boolean
        requiresMFA: boolean
        timestamp: number
        tokenId: string
        senderAddress: string
    }
    baseUrl?: string
}): Promise<string> {
    const payload = await createClaimPayload(link, recipientAddress)

    const result = await postJson<any>(baseUrl, {
        claimParams: payload.claimParams,
        chainId: payload.chainId,
        version: payload.contractVersion,
        apiKey: 'doesnt-matter',
        // Performance optimization: Pass deposit details to skip RPC call
        ...(depositDetails && { depositDetails }),
    })

    return result.transactionHash ?? result.txHash ?? result.hash ?? result.tx_hash ?? ''
}

/**
 * Claims a link x-chain through the Peanut API
 */
async function executeClaimXChain({
    link,
    recipientAddress,
    destinationChainId,
    destinationToken,
    baseUrl = `${next_proxy_url}/claim-x-chain`,
    isMainnet = true,
    slippage = 1,
}: {
    link: string
    recipientAddress: string
    destinationChainId: string
    destinationToken: string | null
    baseUrl?: string
    isMainnet?: boolean
    slippage?: number
}): Promise<string> {
    const payload = await createClaimXChainPayload({
        isMainnet,
        destinationChainId,
        ...(destinationToken !== null && { destinationToken }),
        link: link,
        recipient: recipientAddress,
        squidRouterUrl: `${next_proxy_url}/get-squid-route`,
        slippage,
    })

    const data = await postJson<{ txHash: string }>(baseUrl, {
        apiKey: 'doesnt-matter',
        chainId: payload.chainId,
        contractVersion: payload.contractVersion,
        peanutAddress: payload.peanutAddress,
        depositIndex: payload.depositIndex,
        withdrawalSignature: payload.withdrawalSignature,
        squidFee: payload.squidFee.toString(),
        peanutFee: payload.peanutFee.toString(),
        squidData: payload.squidData,
        routingSignature: payload.routingSignature,
        recipientAddress: recipientAddress,
    })

    return data.txHash
}

const useClaimLink = () => {
    const { fetchBalance } = useWallet()
    const { chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()

    const { setLoadingState } = useContext(loadingStateContext)

    /**
     * Shared mutation lifecycle handlers
     */
    const sharedMutationConfig = useMemo(
        () => ({
            onMutate: () => {
                setLoadingState('Executing transaction')
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            },
            onSettled: () => {
                setLoadingState('Idle')
            },
        }),
        [setLoadingState, queryClient]
    )

    /**
     * TanStack Query mutation for claiming a link
     */
    const claimLinkMutation = useMutation({
        mutationKey: [CLAIM_LINK],
        mutationFn: async ({
            address,
            link,
            depositDetails,
        }: {
            address: string
            link: string
            depositDetails?: {
                pubKey20: string
                amount: string
                tokenAddress: string
                contractType: number
                claimed: boolean
                requiresMFA: boolean
                timestamp: number
                tokenId: string
                senderAddress: string
            }
        }) => {
            return await executeClaim({
                link,
                recipientAddress: address,
                depositDetails,
            })
        },
        ...sharedMutationConfig,
        onSuccess: () => {
            // Regular claim also refreshes balance
            fetchBalance()
            sharedMutationConfig.onSuccess()
        },
        onError: (error) => {
            console.error('Error claiming link:', error)
            captureException(error, {
                tags: { feature: 'claim-link' },
            })
        },
    })

    /**
     * TanStack Query mutation for claiming a link x-chain
     */
    const claimLinkXChainMutation = useMutation({
        mutationKey: [CLAIM_LINK_XCHAIN],
        mutationFn: async ({
            address,
            link,
            destinationChainId,
            destinationToken,
        }: {
            address: string
            link: string
            destinationChainId: string
            destinationToken: string
        }) => {
            const isTestnet = isTestnetChain(destinationChainId)
            return await executeClaimXChain({
                link,
                recipientAddress: address,
                destinationChainId,
                destinationToken,
                isMainnet: !isTestnet,
            })
        },
        ...sharedMutationConfig,
        onError: (error) => {
            console.error('Error claiming link x-chain:', error)
            captureException(error, {
                tags: { feature: 'claim-link-xchain' },
            })
        },
    })

    /**
     * Legacy wrapper for backward compatibility
     * Use claimLinkMutation.mutateAsync() directly for better type safety
     */
    const claimLink = async ({
        address,
        link,
        depositDetails,
    }: {
        address: string
        link: string
        depositDetails?: {
            pubKey20: string
            amount: string
            tokenAddress: string
            contractType: number
            claimed: boolean
            requiresMFA: boolean
            timestamp: number
            tokenId: string
            senderAddress: string
        }
    }) => {
        return await claimLinkMutation.mutateAsync({ address, link, depositDetails })
    }

    /**
     * Legacy wrapper for backward compatibility
     * Use claimLinkXChainMutation.mutateAsync() directly for better type safety
     */
    const claimLinkXchain = async ({
        address,
        link,
        destinationChainId,
        destinationToken,
    }: {
        address: string
        link: string
        destinationChainId: string
        destinationToken: string
    }) => {
        return await claimLinkXChainMutation.mutateAsync({
            address,
            link,
            destinationChainId,
            destinationToken,
        })
    }

    const switchNetwork = async (chainId: string) => {
        try {
            await switchNetworkUtil({
                chainId,
                currentChainId: String(currentChain?.id),
                setLoadingState,
                switchChainAsync: async ({ chainId }) => {
                    await switchChainAsync({ chainId: chainId as number })
                },
            })
            console.log(`Switched to chain ${chainId}`)
        } catch (error) {
            console.error('Failed to switch network:', error)
            captureException(error)
        }
    }

    const addParamStep = (step: 'bank' | 'claim' | 'regional-claim' | 'regional-req-fulfill') => {
        const params = new URLSearchParams(searchParams)
        params.set('step', step)

        const hash = window.location.hash
        const newUrl = `${pathname}?${params.toString()}${hash}`
        window.history.replaceState(null, '', newUrl)
    }

    const removeParamStep = () => {
        const params = new URLSearchParams(searchParams)
        params.delete('step')
        const queryString = params.toString()
        const newUrl = `${pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`
        window.history.replaceState(null, '', newUrl)
    }

    /**
     * Cancels a send link by claiming it back to the user's wallet
     * @param link - The link to cancel
     * @param walletAddress - The user's wallet address to claim back to
     * @param userId - Optional user ID for error tracking
     * @returns The transaction hash if successful
     */
    const cancelLinkAndClaim = async ({
        link,
        walletAddress,
        userId,
    }: {
        link: string
        walletAddress: string
        userId?: string
    }) => {
        try {
            // Use secure SDK claim (password stays client-side)
            const txHash = await claimLink({
                address: walletAddress,
                link,
            })

            if (txHash) {
                // Associate the claim with user history
                try {
                    await sendLinksApi.associateClaim(txHash)
                } catch (e) {
                    console.error('Failed to associate claim:', e)
                    captureException(e, {
                        tags: { feature: 'cancel-link' },
                        extra: { txHash, userId },
                    })
                }
            }

            return txHash
        } catch (error) {
            console.error('Error cancelling link:', error)
            throw error
        }
    }

    /**
     * Polls the backend to check if a claim transaction has been confirmed
     * @param link - The link to check
     * @param maxAttempts - Maximum number of polling attempts (default: 20)
     * @param delayMs - Delay between attempts in milliseconds (default: 500)
     * @returns true if confirmed, false if timeout
     */
    const pollForClaimConfirmation = async (link: string, maxAttempts = 20, delayMs = 500): Promise<boolean> => {
        let attempts = 0

        while (attempts < maxAttempts) {
            try {
                const linkData = await sendLinksApi.get(link)

                // Check if claim is confirmed
                if (linkData.claim?.txHash) {
                    return true
                }

                // Check if link failed
                if (linkData.status === ESendLinkStatus.FAILED) {
                    throw new Error('Link claim failed')
                }
            } catch (e) {
                console.error('Error polling for claim confirmation:', e)
                // Continue polling even on errors (network issues, etc.)
            }

            attempts++
            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        // Timeout - transaction might still be pending
        return false
    }

    return {
        // Mutations for advanced usage
        claimLinkMutation,
        claimLinkXChainMutation,

        // Legacy wrappers for backward compatibility
        claimLink,
        claimLinkXchain,

        // Utility functions
        switchNetwork,
        addParamStep,
        removeParamStep,
        cancelLinkAndClaim,
        pollForClaimConfirmation,
    }
}

export default useClaimLink
