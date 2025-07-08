'use server'
import type { PublicClient, Chain } from 'viem'
import { createPublicClient, http, extractChain } from 'viem'
import * as chains from 'viem/chains'

import { PUBLIC_CLIENTS_BY_CHAIN, infuraRpcUrls } from '@/constants'

const allChains = Object.values(chains)
export type ChainId = (typeof allChains)[number]['id']

export const getPublicClient = async (chainId: ChainId): Promise<PublicClient> => {
    let client: PublicClient | undefined = PUBLIC_CLIENTS_BY_CHAIN[chainId]?.client
    if (client) return client
    const chain: Chain = extractChain({ chains: allChains, id: chainId })
    if (!chain) throw new Error(`No chain found for chainId ${chainId}`)
    return createPublicClient({
        transport: http(infuraRpcUrls[chainId]),
        chain,
    })
}
