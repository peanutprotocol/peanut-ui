import { chains } from '@/constants/chains.consts'
import { ethers } from 'ethers'

/**
 * Generates an Infura API URL for supported networks
 * @param network - The network name (e.g., 'mainnet', 'optimism-mainnet', 'polygon-mainnet', 'arbitrum-mainnet')
 * @returns The Infura RPC URL
 */
export const getInfuraApiUrl = (network: string): string => {
    return `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
}

/**
 * Retrieves the JSON-RPC provider for a given blockchain network.
 *
 * @param chainId - The unique identifier of the blockchain network as a string.
 * @returns An instance of `ethers.providers.JsonRpcProvider` configured with the network's RPC URL and chain ID.
 * @throws Will throw an error if the chain with the specified `chainId` is not found.
 *
 * @remarks
 * This function uses the `ethers` library to create a JSON-RPC provider, which is required by the Peanut SDK.
 */
export const getChainProvider = (chainId: string) => {
    const chain = chains.find((chain) => chain.id.toString() === chainId)

    if (!chain) throw new Error(`Chain ${chainId} not found`)

    // using ethers cuz peanut sdk accepts provider type to be from ethers atm 🫠
    return new ethers.providers.JsonRpcProvider(chain.rpcUrls.default.http[0], Number(chainId))
}
