import { unstable_cache } from '@/utils/no-cache'
import { getTokenDetails } from '@/utils/general.utils'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { fetchTokenPrice } from '@/services/tokens-price'
import { parseAbi, formatUnits } from 'viem'
import { type ChainId, getPublicClient } from '@/app/actions/clients'
import type { Address, Hex } from 'viem'

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

/**
 * Get cached gas price for a chain
 */
const getCachedGasPrice = unstable_cache(
    async (chainId: string) => {
        const client = getPublicClient(Number(chainId) as ChainId)
        const gasPrice = await client.getGasPrice()
        return gasPrice.toString()
    },
    ['getGasPrice'],
    {
        revalidate: 2 * 60, // 2 minutes
    }
)

/**
 * Get cached gas estimate for a transaction
 */
const getCachedGasEstimate = unstable_cache(
    async (fromAddress: Address, contractAddress: Address, data: Hex, chainId: string) => {
        const client = getPublicClient(Number(chainId) as ChainId)
        const gasEstimate = await client.estimateGas({
            account: fromAddress,
            to: contractAddress,
            data,
        })
        return gasEstimate.toString()
    },
    ['getGasEstimate'],
    {
        revalidate: 5 * 60, // 5 minutes - gas estimates are more stable
    }
)

/**
 * Estimate gas cost for transaction in USD
 */
export async function estimateTransactionCostUsd(
    fromAddress: Address,
    contractAddress: Address,
    data: Hex,
    chainId: string
): Promise<number> {
    try {
        // Run all API calls in parallel since they're independent
        const [gasEstimateStr, gasPriceStr, nativeTokenPrice] = await Promise.all([
            getCachedGasEstimate(fromAddress, contractAddress, data, chainId),
            getCachedGasPrice(chainId),
            fetchTokenPrice(NATIVE_TOKEN_ADDRESS, chainId),
        ])

        // Convert strings back to BigInt for calculation
        const gasEstimate = BigInt(gasEstimateStr)
        const gasPrice = BigInt(gasPriceStr)

        // Calculate gas cost in native token
        const gasCostWei = gasEstimate * gasPrice

        const estimatedCostUsd = nativeTokenPrice
            ? Number(formatUnits(gasCostWei, nativeTokenPrice.decimals)) * nativeTokenPrice.price
            : 0.01

        return estimatedCostUsd
    } catch (error) {
        console.error('Error estimating transaction cost:', error)
        // Return a conservative estimate if we can't calculate exact cost
        return 0.01
    }
}
