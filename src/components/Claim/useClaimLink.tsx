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
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const useClaimLink = () => {
    const { fetchBalance } = useWallet()
    const { chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const router = useRouter()

    const { setLoadingState } = useContext(loadingStateContext)

    const claimLink = async ({ address, link }: { address: string; link: string }) => {
        setLoadingState('Executing transaction')
        try {
            const claimTx = await claimLinkGasless({
                link,
                recipientAddress: address,
                baseUrl: `${consts.next_proxy_url}/claim-v2`,
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

    const addParamStep = () => {
        const params = new URLSearchParams(searchParams)
        params.set('step', 'bank')

        const hash = window.location.hash
        router.replace(`${pathname}?${params.toString()}${hash}`, { scroll: false })
    }

    const removeParamStep = () => {
        const params = new URLSearchParams(searchParams)
        params.delete('step')
        const queryString = params.toString()
        router.replace(`${pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`, { scroll: false })
    }

    return {
        claimLink,
        claimLinkXchain,
        switchNetwork,
        addParamStep,
        removeParamStep,
    }
}

export default useClaimLink
