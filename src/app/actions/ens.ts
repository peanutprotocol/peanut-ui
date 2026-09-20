import { unstable_cache } from '@/utils/no-cache'
import { serverFetch } from '@/utils/api-fetch'
import { isSupportedEnsName, normalizeEnsInput } from '@/lib/validation/ens'

export const resolveEns = unstable_cache(
    async (ensName: string, chainId?: string): Promise<string | undefined> => {
        // Central gate before the name becomes a URL path segment, so a call
        // site that skips validation cannot put free text on the wire.
        // Undefined is what callers already handle for an unresolved name.
        if (!isSupportedEnsName(ensName)) return undefined
        // Send the form the guard accepted, not the raw input.
        const name = normalizeEnsInput(ensName)

        // ENSIP-11: names can hold a distinct address per chain — resolve for
        // the destination chain, not just mainnet. Backend falls back to the
        // ETH (coinType 60) record when no chain-specific record exists.
        const numericChainId = chainId ? Number(chainId) : undefined
        const query = numericChainId && Number.isInteger(numericChainId) ? `?chainId=${numericChainId}` : ''
        const response = await serverFetch(`/ens/${encodeURIComponent(name)}${query}`, {
            method: 'GET',
        })
        if (response.status === 404) return undefined

        const data: { address: string } = await response.json()

        return data.address
    },
    ['resolveEns'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)
