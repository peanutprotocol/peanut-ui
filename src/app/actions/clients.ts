import { rpcUrls } from '@/constants/general.consts'
import { BUNDLER_URL, PAYMASTER_URL, PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import type { PublicClient, Chain, Transport } from 'viem'
import { createPublicClient, http, extractChain, fallback } from 'viem'
import * as chains from 'viem/chains'
import { arbitrum, mainnet, base, linea } from 'viem/chains'

const allChains = Object.values(chains)
export type ChainId = (typeof allChains)[number]['id']

/**
 * Returns viem transport with fallback
 *
 * @see https://viem.sh/docs/clients/transports/fallback#fallback-transport
 */
export function getTransportWithFallback(chainId: ChainId): Transport {
    const providerUrls = rpcUrls?.[chainId]
    if (!providerUrls || !Array.isArray(providerUrls) || providerUrls.length === 0) {
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

const ZERODEV_V3_URL = process.env.NEXT_PUBLIC_ZERO_DEV_RECOVERY_BUNDLER_URL
const zerodevV3Url = (chainId: number | string) => `${ZERODEV_V3_URL}/chain/${chainId}`

/**
 * This is a mapping of chain ID to the public client and chain details
 * This is for the standard chains supported in the app. Arbitrum is always included
 * as it's the primary wallet chain. Additional chains (mainnet, base, linea) are only
 * included if NEXT_PUBLIC_ZERO_DEV_RECOVERY_BUNDLER_URL is configured.
 * Note: PUBLIC_CLIENTS_BY_CHAIN and peanutPublicClient are now exported from here to avoid circular dependencies
 */
export const PUBLIC_CLIENTS_BY_CHAIN: Record<
    string,
    {
        client: PublicClient
        chain: Chain
        bundlerUrl: string
        paymasterUrl: string
    }
> = {
    // Arbitrum (primary wallet chain - always included)
    [arbitrum.id]: {
        client: createPublicClient({
            transport: getTransportWithFallback(arbitrum.id),
            chain: arbitrum,
            pollingInterval: 500,
        }),
        chain: PEANUT_WALLET_CHAIN,
        bundlerUrl: BUNDLER_URL,
        paymasterUrl: PAYMASTER_URL,
    },
}

// Conditionally add recovery chains if env var is configured
if (ZERODEV_V3_URL) {
    const mainnetUrl = zerodevV3Url(mainnet.id)
    if (mainnetUrl) {
        PUBLIC_CLIENTS_BY_CHAIN[mainnet.id] = {
            client: createPublicClient({
                transport: getTransportWithFallback(mainnet.id),
                chain: mainnet,
                pollingInterval: 12000,
            }),
            chain: mainnet,
            bundlerUrl: mainnetUrl,
            paymasterUrl: mainnetUrl,
        }
    }

    const baseUrl = zerodevV3Url(base.id)
    if (baseUrl) {
        PUBLIC_CLIENTS_BY_CHAIN[base.id] = {
            client: createPublicClient({
                transport: getTransportWithFallback(base.id),
                chain: base,
                pollingInterval: 2000,
            }) as PublicClient,
            chain: base,
            bundlerUrl: baseUrl,
            paymasterUrl: baseUrl,
        }
    }

    const lineaUrl = zerodevV3Url(linea.id)
    if (lineaUrl) {
        PUBLIC_CLIENTS_BY_CHAIN[linea.id] = {
            client: createPublicClient({
                transport: getTransportWithFallback(linea.id),
                chain: linea,
                pollingInterval: 3000,
            }),
            chain: linea,
            bundlerUrl: lineaUrl,
            paymasterUrl: lineaUrl,
        }
    }
}

export const peanutPublicClient = PUBLIC_CLIENTS_BY_CHAIN[PEANUT_WALLET_CHAIN.id].client

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
