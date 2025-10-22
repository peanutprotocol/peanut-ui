'use client'

import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import { claimLinkGasless, claimLinkXChainGasless } from '@squirrel-labs/peanut-sdk'
import { useContext } from 'react'
import { useSwitchChain } from 'wagmi'

import * as consts from '@/constants'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { isTestnetChain } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useAccount } from 'wagmi'
import { usePathname, useSearchParams } from 'next/navigation'
import { sendLinksApi, ESendLinkStatus } from '@/services/sendLinks'

const useClaimLink = () => {
    const { fetchBalance } = useWallet()
    const { chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { setLoadingState } = useContext(loadingStateContext)

    const claimLink = async ({ address, link }: { address: string; link: string }) => {
        setLoadingState('Executing transaction')
        try {
            const claimTx = await claimLinkGasless({
                link,
                recipientAddress: address,
                baseUrl: `${consts.next_proxy_url}/claim-v3`,
                APIKey: 'doesnt-matter',
            })

            fetchBalance()

            return claimTx.transactionHash ?? claimTx.txHash ?? claimTx.hash ?? claimTx.tx_hash ?? ''
        } catch (error) {
            console.error('Error claiming link:', error)

            throw error
        } finally {
            setLoadingState('Idle')
        }
    }

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
        setLoadingState('Executing transaction')
        try {
            const isTestnet = isTestnetChain(destinationChainId)
            const claimTx = await claimLinkXChainGasless({
                link,
                recipientAddress: address,
                destinationChainId,
                destinationToken,
                isMainnet: !isTestnet,
                squidRouterUrl: `${consts.next_proxy_url}/get-squid-route`,
                baseUrl: `${consts.next_proxy_url}/claim-x-chain`,
                APIKey: 'doesnt-matter',
                slippage: 1,
            })

            return claimTx.txHash
        } catch (error) {
            console.error('Error claiming link:', error)
            throw error
        } finally {
            setLoadingState('Idle')
        }
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
            Sentry.captureException(error)
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
                    Sentry.captureException(e, {
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
        claimLink,
        claimLinkXchain,
        switchNetwork,
        addParamStep,
        removeParamStep,
        cancelLinkAndClaim,
        pollForClaimConfirmation,
    }
}

export default useClaimLink
