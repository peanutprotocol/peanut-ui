import peanut from '@squirrel-labs/peanut-sdk'
import { rpcUrls } from '@/constants/general.consts'
import { providers } from 'ethers'
import * as Sentry from '@sentry/nextjs'

/**
 * Gets a provider for a given chain, trying each RPC URL until one is successful.
 * @param chainId - The ID of the chain to get a provider for.
 * @returns A provider for the given chain, or undefined if no provider could be created.
 */
export async function getSDKProvider({ chainId }: { chainId: string }): Promise<providers.Provider | undefined> {
    const urls = rpcUrls[Number(chainId)]

    if (!urls || urls.length === 0) {
        console.error(`No RPC URLs found for chain ID ${chainId}`)
        try {
            // fallback to the default provider if no RPC URLs are found
            return await peanut.getDefaultProvider(chainId)
        } catch (error) {
            Sentry.captureException(error)
            console.error(`Failed to get default provider for chain ID ${chainId}`, error)
            return undefined
        }
    }

    for (const url of urls) {
        try {
            const provider = new providers.JsonRpcProvider(url)
            await provider.getNetwork() // check if the provider is valid
            return provider
        } catch (error) {
            Sentry.captureException(error)
            console.warn(`Failed to connect to RPC URL ${url} for chain ID ${chainId}`, error)
        }
    }

    Sentry.captureException(new Error(`Failed to create a provider for chain ID ${chainId}`))
    console.error(`Failed to create a provider for chain ID ${chainId}`)
    return undefined
}
