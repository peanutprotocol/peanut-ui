'use server'
import { unstable_cache } from 'next/cache'
import { fetchWithSentry, isAddressZero, estimateIfIsStableCoinFromPrice } from '@/utils'
import { type ITokenPriceData } from '@/interfaces'
import { parseAbi, formatUnits } from 'viem'
import { type ChainId, getPublicClient } from '@/app/actions/clients'
import { getTokenDetails, isStableCoin, NATIVE_TOKEN_ADDRESS, areEvmAddressesEqual } from '@/utils'
import { IUserBalance } from '@/interfaces'
import type { Address, Hex } from 'viem'

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

type IMobulaContractBalanceData = {
    address: string //of the contract
    balance: number
    balanceRaw: string
    chainId: string // this chainId is og the type evm:<chainId>
    decimals: number
}

type IMobulaCrossChainBalanceData = {
    balance: number
    balanceRaw: string
    chainId: string
    address: string //of the token
}

type IMobulaAsset = {
    id: number
    name: string
    symbol: string
    logo: string
    decimals: string[]
    contracts: string[]
    blockchains: string[]
}

type IMobulaAssetData = {
    contracts_balances: IMobulaContractBalanceData[]
    cross_chain_balances: Record<string, IMobulaCrossChainBalanceData> // key is the same as in asset.blockchains    price_change_24h: number
    estimated_balance: number
    price: number
    token_balance: number
    allocation: number
    asset: IMobulaAsset
    wallets: string[]
}

type IMobulaPortfolioData = {
    total_wallet_balance: number
    wallets: string[]
    assets: IMobulaAssetData[]
    balances_length: number
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
                if (isStableCoin(data.symbol) || estimateIfIsStableCoinFromPrice(json.data.price)) {
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

/**
 * Get cached gas price for a chain
 */
const getCachedGasPrice = unstable_cache(
    async (chainId: string) => {
        const client = await getPublicClient(Number(chainId) as ChainId)
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
        const client = await getPublicClient(Number(chainId) as ChainId)
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

export const fetchWalletBalances = unstable_cache(
    async (address: string): Promise<{ balances: IUserBalance[]; totalBalance: number }> => {
        const mobulaResponse = await fetchWithSentry(`https://api.mobula.io/api/1/wallet/portfolio?wallet=${address}`, {
            headers: {
                'Content-Type': 'application/json',
                authorization: process.env.MOBULA_API_KEY!,
            },
        })

        if (!mobulaResponse.ok) throw new Error('Failed to fetch wallet balances')

        const json: { data: IMobulaPortfolioData } = await mobulaResponse.json()
        const assets = json.data.assets
            .filter((a: IMobulaAssetData) => !!a.price)
            .filter((a: IMobulaAssetData) => !!a.token_balance)
        const balances = []
        for (const asset of assets) {
            const symbol = asset.asset.symbol
            const price = isStableCoin(symbol) || estimateIfIsStableCoinFromPrice(asset.price) ? 1 : asset.price
            /*
           Mobula returns balances per asset, IE: USDC on arbitrum, mainnet
           and optimism are all part of the same "asset", here we need to
           divide it
          */
            for (const chain of asset.asset.blockchains) {
                const address = asset.cross_chain_balances[chain].address
                const contractInfo = asset.contracts_balances.find((c) => areEvmAddressesEqual(c.address, address))
                const crossChainBalance = asset.cross_chain_balances[chain]
                balances.push({
                    chainId: crossChainBalance.chainId,
                    address,
                    name: asset.asset.name,
                    symbol,
                    decimals: contractInfo!.decimals,
                    price,
                    amount: crossChainBalance.balance,
                    currency: 'usd',
                    logoURI: asset.asset.logo,
                    value: (crossChainBalance.balance * price).toString(),
                })
            }
        }
        const totalBalance = balances.reduce(
            (acc: number, balance: IUserBalance) => acc + balance.amount * balance.price,
            0
        )
        return {
            balances,
            totalBalance,
        }
    },
    ['fetchWalletBalances'],
    {
        tags: ['fetchWalletBalances'],
        revalidate: 5, // 5 seconds
    }
)
