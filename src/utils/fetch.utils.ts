import { type ITokenPriceData } from '@/interfaces'
import * as utils from '@/utils'

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

export const fetchTokenPrice = async (
    tokenAddress: string,
    chainId: string,
    host?: string
): Promise<ITokenPriceData | undefined> => {
    try {
        // Routing mobula api call through nextjs BFF
        const mobulaResponse = await fetch(
            host ? `${host}/api/mobula/fetch-token-price` : `/api/mobula/fetch-token-price`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenAddress: utils.isAddressZero(tokenAddress)
                        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                        : tokenAddress,
                    chainId,
                }),
            }
        )
        const json: { data: IMobulaMarketData } = await mobulaResponse.json()

        if (mobulaResponse.ok) {
            let decimals = json.data.decimals
            if (decimals === undefined) {
                decimals = json.data.contracts.find((contract) => contract.blockchainId === chainId)!.decimals
            }
            let data = {
                price: json.data.price,
                chainId: chainId,
                address: tokenAddress,
                name: json.data.name,
                symbol: json.data.symbol,
                decimals,
                logoURI: json.data.logo,
            }
            if (utils.estimateStableCoin(json.data.price)) {
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
}

// helper function to create infura url
export const getInfuraApiUrl = (network: string) =>
    `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
