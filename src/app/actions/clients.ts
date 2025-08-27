import type { PublicClient, Chain, Transport } from 'viem'
import { createPublicClient, http, extractChain, fallback } from 'viem'
import * as chains from 'viem/chains'

import { PUBLIC_CLIENTS_BY_CHAIN, rpcUrls } from '@/constants'

const allChains = Object.values(chains)
export type ChainId = (typeof allChains)[number]['id']

/**
 * Returns viem transport with fallback
 *
 * @see https://viem.sh/docs/clients/transports/fallback#fallback-transport
 */
export function getTransportWithFallback(chainId: ChainId): Transport {
    const providerUrls = rpcUrls[chainId]
    if (!providerUrls) {
        // If no premium providers are configured, viem will use a default one
        return http()
    }
    return fallback(
        providerUrls.map((u) => http(u)),
        // Viem checks the status of the provider every 60 seconds and notes latency
        // and stability. The provider that viem will try first depend on this
        // ranking
        { rank: { interval: 60_000 } }
    )
}

export function getPublicClient(chainId: ChainId): PublicClient {
    let client: PublicClient | undefined = PUBLIC_CLIENTS_BY_CHAIN[chainId]?.client
    if (client) return client
    const chain: Chain = extractChain({ chains: allChains, id: chainId })
    if (!chain) throw new Error(`No chain found for chainId ${chainId}`)
    return createPublicClient({
        transport: getTransportWithFallback(chainId),
        chain,
    })
}
