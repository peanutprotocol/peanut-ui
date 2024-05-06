'useClient'

import { useContext, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { claimLinkGasless, claimLinkXChainGasless, interfaces } from '@squirrel-labs/peanut-sdk'

import * as context from '@/context'
import * as consts from '@/constants'
import * as utils from '@/utils'
export const useClaimLink = () => {
    const { chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()

    const { loadingState, setLoadingState } = useContext(context.loadingStateContext)

    const xchainFeeMultiplier = 0.98

    const claimLink = async ({ address, link }: { address: string; link: string }) => {
        setLoadingState('Executing transaction')
        try {
            const claimTx = await claimLinkGasless({
                link,
                recipientAddress: address,
                baseUrl: `${consts.next_proxy_url}/claim-v2`,
                APIKey: 'doesnt-matter',
            })

            return claimTx.transactionHash ?? claimTx.txHash ?? claimTx.hash ?? claimTx.tx_hash ?? ''
        } catch (error) {
            console.log('Error claiming link:', error)

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
            })

            return claimTx.txHash
        } catch (error) {
            console.log('Error claiming link:', error)
            throw error
        } finally {
            setLoadingState('Idle')
        }
    }

    const getSquidRoute = async ({
        linkDetails,
        destinationChainId,
        destinationToken,
    }: {
        linkDetails: interfaces.IPeanutLinkDetails
        destinationChainId: string
        destinationToken: string
    }) => {}

    const switchNetwork = async (chainId: string) => {
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingState('Allow network switch')

            try {
                await switchChainAsync({ chainId: Number(chainId) })
                setLoadingState('Switching network')
                await new Promise((resolve) => setTimeout(resolve, 2000))
                setLoadingState('Loading')
            } catch (error) {
                setLoadingState('Idle')
                console.error('Error switching network:', error)
                // TODO: handle error, either throw or return error
            }
        }
    }

    const checkTxStatus = async (txHash: string) => {}

    const sendNotification = async () => {}

    return {
        xchainFeeMultiplier,
        claimLink,
        claimLinkXchain,
        getSquidRoute,
        switchNetwork,
        checkTxStatus,
        sendNotification,
    }
}

export default useClaimLink
