import peanut from '@squirrel-labs/peanut-sdk'
import { rpcUrls } from '@/constants/general.consts'
import { providers } from 'ethers'
import * as Sentry from '@sentry/nextjs'

const providerCache = new Map<string, providers.Provider>()

/**
 * Gets a provider for a given chain. It uses a cached provider if available.
 * If not, it creates a new FallbackProvider with multiple RPC URLs for resiliency,
 * or falls back to the default provider.
 * @param chainId - The ID of the chain to get a provider for.
 * @returns A provider for the given chain, or undefined if no provider could be created.
 */
export async function getSDKProvider({ chainId }: { chainId: string }): Promise<providers.Provider | undefined> {
    if (providerCache.has(chainId)) {
        return providerCache.get(chainId)
    }

    const urls = rpcUrls[Number(chainId)]

    // f we have specific RPC URLs, use them with a FallbackProvider for resiliency.
    if (urls && urls.length > 0) {
        try {
            const providerConfigs: providers.FallbackProviderConfig[] = urls.map((url, index) => ({
                provider: new providers.JsonRpcProvider(url),
                priority: index,
                stallTimeout: 2000, // a request that has not returned in 2s is considered stalled
            }))

            const fallbackProvider = new providers.FallbackProvider(providerConfigs, 1) // Quorum of 1, we only need one to work.

            await fallbackProvider.getNetwork() // this checks if at least one provider is responsive.

            providerCache.set(chainId, fallbackProvider)
            return fallbackProvider
        } catch (error) {
            Sentry.captureException(error)
            console.warn(
                `FallbackProvider creation failed for chain ID ${chainId}, falling back to default. Error:`,
                error
            )
        }
    }

    // fallback to the default provider from the SDK if no URLs are specified or if FallbackProvider fails.
    try {
        const provider = await peanut.getDefaultProvider(chainId)
        providerCache.set(chainId, provider)
        return provider
    } catch (error) {
        Sentry.captureException(error)
        console.error(`Failed to get default provider for chain ID ${chainId}`, error)
    }

    Sentry.captureException(new Error(`Failed to create any provider for chain ID ${chainId}`))
    console.error(`Failed to create a provider for chain ID ${chainId}`)
    return undefined
}
