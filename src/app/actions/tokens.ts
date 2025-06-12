'use server'
import { unstable_cache } from 'next/cache'
import { fetchWithSentry, isAddressZero, estimateIfIsStableCoinFromPrice } from '@/utils'
import { type ITokenPriceData } from '@/interfaces'
import type { Address } from 'viem'
import { parseAbi } from 'viem'
import { type ChainId, getPublicClient } from '@/app/actions/clients'
import { getTokenDetails } from '@/utils'

type IMobulaMarketData = {
    id: number
    market_cap: number
    market_cap_diluted: number
    liquidity: number
    price: number
    off_chain_volume: number
    volume: number
    volume_change_24h: number
    volume_7d: number
    is_listed: boolean
    price_change_24h: number
    price_change_1h: number
    price_change_7d: number
    price_change_1m: number
    price_change_1y: number
    ath: number
    atl: number
    name: string
    symbol: string
    logo: string
    rank: number
    contracts: {
        address: string
        blockchain: string
        blockchainId: string
        decimals: number
    }[]
    total_supply: string
    circulating_supply: string
    decimals?: number
    priceNative: number
    native: {
        name: string
        address: string
        decimals: number
        symbol: string
        type: string
        logo: string
        id: number
    }
}

const ERC20_DATA_ABI = parseAbi([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
])

export const fetchTokenPrice = unstable_cache(
    async (tokenAddress: string, chainId: string): Promise<ITokenPriceData | undefined> => {
        try {
            const API_KEY = process.env.MOBULA_API_KEY ?? ''

            if (!API_KEY) throw new Error('MOBULA_API_KEY not found in env')
            tokenAddress = isAddressZero(tokenAddress) ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : tokenAddress

            const mobulaResponse = await fetchWithSentry(
                `https://api.mobula.io/api/1/market/data?asset=${tokenAddress}&blockchain=${chainId}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        authorization: API_KEY,
                    },
                }
            )
            const json: { data: IMobulaMarketData } = await mobulaResponse.json()

            if (mobulaResponse.ok) {
                const decimals = json.data.contracts.find((contract) => contract.blockchainId === chainId)!.decimals
                let data = {
                    price: json.data.price,
                    chainId: chainId,
                    address: tokenAddress,
                    name: json.data.name,
                    symbol: json.data.symbol,
                    decimals,
                    logoURI: json.data.logo,
                }
                if (estimateIfIsStableCoinFromPrice(json.data.price)) {
                    data.price = 1
                }
                return data
            } else {
                return undefined
            }
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress + ' on chain ' + chainId)
            return undefined
        }
    },
    ['fetchTokenPrice'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)

export const fetchTokenDetails = unstable_cache(
    async (
        tokenAddress: string,
        chainId: string
    ): Promise<{
        symbol: string
        name: string
        decimals: number
    }> => {
        console.log('chain id', chainId)
        const tokenDetails = getTokenDetails({ tokenAddress: tokenAddress as Address, chainId: chainId! })
        if (tokenDetails) return tokenDetails
        const client = await getPublicClient(Number(chainId) as ChainId)
        console.log('token address', tokenAddress)
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
