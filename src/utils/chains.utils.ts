import { chains } from '@/constants/chains.consts'
import peanut from '@squirrel-labs/peanut-sdk'

/**
 * Generates an Infura API URL for supported networks
 * @param network - The network name (e.g., 'mainnet', 'optimism-mainnet', 'polygon-mainnet', 'arbitrum-mainnet')
 * @returns The Infura RPC URL
 */
export const getInfuraApiUrl = (network: string): string => {
    return `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
}

/**
 * Retrieves the JSON-RPC provider for a given blockchain network with fallback to public RPC.
 */
export const getChainProvider = async (chainId: string) => {
    const chain = chains.find((chain) => chain.id.toString() === chainId)
    if (!chain) throw new Error(`Chain ${chainId} not found`)

    // Try default (Infura) provider first
    try {
        const defaultProvider = await peanut.getDefaultProvider(chainId)
        await defaultProvider.getNetwork() // Test the connection
        return defaultProvider
    } catch (error) {
        console.warn(`Default RPC failed for chain ${chainId}, falling back to public RPC`)

        // Fallback to public RPC
        const publicRpcUrl = chain.rpcUrls.public.http[0]
        if (!publicRpcUrl) {
            throw new Error(`No public RPC URL found for chain ${chainId}`)
        }

        return peanut.getDefaultProvider(publicRpcUrl)
    }
}
