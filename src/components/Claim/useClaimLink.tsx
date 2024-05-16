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

    const estimatePoints = async ({
        address,
        link,
        chainId,
        amountUSD,
    }: {
        address: string
        link: string
        chainId: string
        amountUSD: number
    }) => {
        try {
            const response = await fetch('https://api.staging.peanut.to/calculate-pts-for-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    actionType: 'CLAIM',
                    link: link,
                    userAddress: address,
                    chainId: chainId,
                    amountUsd: amountUSD,
                }),
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            console.log(data.points)
            return Math.round(data.points)
        } catch (error) {
            console.error('Failed to estimate points:', error)
            return 0
        }
    }

    const estimatePodints = async ({
        chainId,
        preparedTx,
        address,
        amountUSD,
    }: {
        chainId: string
        preparedTx: any // This could be detailed further depending on the transaction structure
        address: string
        amountUSD: number
    }) => {
        try {
            console.log(preparedTx)
            const response = await fetch('https://api.staging.peanut.to/calculate-pts-for-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    actionType: 'CREATE',
                    amountUsd: amountUSD,
                    transaction: {
                        from: preparedTx.from ? preparedTx.from.toString() : address,
                        to: preparedTx.to ? preparedTx.to.toString() : '',
                        data: preparedTx.data ? preparedTx.data.toString() : '',
                        value: preparedTx.value ? preparedTx.value.toString() : '',
                    },
                    chainId: chainId,
                    userAddress: address,
                }),
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            console.log(data.points)
            return Math.round(data.points)
        } catch (error) {
            console.error('Failed to estimate points:', error)
            return 0 // Returning 0 or another error handling strategy could be implemented here
        }
    }
    return {
        xchainFeeMultiplier,
        claimLink,
        claimLinkXchain,
        getSquidRoute,
        switchNetwork,
        checkTxStatus,
        sendNotification,
        estimatePoints,
    }
}

export default useClaimLink
