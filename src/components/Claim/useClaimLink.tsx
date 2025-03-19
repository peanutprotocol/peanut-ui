'useClient'

import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import { claimLinkGasless, claimLinkXChainGasless } from '@squirrel-labs/peanut-sdk'
import { useContext } from 'react'
import { useSwitchChain } from 'wagmi'
import { fetchWithSentry } from '@/utils'

import * as consts from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import * as utils from '@/utils'
import * as Sentry from '@sentry/nextjs'

export const useClaimLink = () => {
    const { chain: currentChain, refetchBalances } = useWallet()
    const { switchChainAsync } = useSwitchChain()

    const { setLoadingState } = useContext(context.loadingStateContext)

    const claimLink = async ({ address, link }: { address: string; link: string }) => {
        setLoadingState('Executing transaction')
        try {
            const claimTx = await claimLinkGasless({
                link,
                recipientAddress: address,
                baseUrl: `${consts.next_proxy_url}/claim-v2`,
                APIKey: 'doesnt-matter',
            })

            // refetch wallet balance after successful claim
            refetchBalances(address)

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
            const isTestnet = utils.isTestnetChain(destinationChainId)
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

    const getAttachmentInfo = async (link: string) => {
        try {
            const response = await fetchWithSentry('/api/peanut/get-attachment-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ link }),
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()

            return {
                fileUrl: data.fileUrl,
                message: data.message,
            }
        } catch (error) {
            console.error('Failed to get attachment:', error)
            Sentry.captureException(error)
        }
    }

    return {
        claimLink,
        claimLinkXchain,
        switchNetwork,
        getAttachmentInfo,
    }
}

export default useClaimLink
