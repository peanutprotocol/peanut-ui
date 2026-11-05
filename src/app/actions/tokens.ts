import { unstable_cache } from '@/utils/no-cache'
import { getTokenDetails } from '@/utils/general.utils'
import { parseAbi } from 'viem'
import { type ChainId, getPublicClient } from '@/app/actions/clients'
import type { Address } from 'viem'

const ERC20_DATA_ABI = parseAbi([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
])

export const fetchTokenDetails = unstable_cache(
    async (
        tokenAddress: string,
        chainId: string
    ): Promise<{
        symbol: string
        name: string
        decimals: number
    }> => {
        const tokenDetails = getTokenDetails({ tokenAddress: tokenAddress as Address, chainId: chainId! })
        if (tokenDetails) return tokenDetails
        const client = getPublicClient(Number(chainId) as ChainId)
        const [symbol, name, decimals] = await Promise.all([
            client.readContract({
                address: tokenAddress as Address,
                abi: ERC20_DATA_ABI,
                functionName: 'symbol',
            }),
            client.readContract({
                address: tokenAddress as Address,
                abi: ERC20_DATA_ABI,
                functionName: 'name',
            }),
            client.readContract({
                address: tokenAddress as Address,
                abi: ERC20_DATA_ABI,
                functionName: 'decimals',
            }),
        ])
        if (!symbol || !name || !decimals) throw new Error('Failed to fetch token details')
        return { symbol, name, decimals }
    },
    ['fetchTokenDetails'],
    {
        tags: ['fetchTokenDetails'],
    }
)
