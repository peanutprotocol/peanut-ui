import * as utils from '@/utils'

export const fetchTokenPrice = async (tokenAddress: string, chainId: string, host?: string) => {
    try {
        if (tokenAddress.toLowerCase() == '0x0000000000000000000000000000000000000000') {
            tokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        }

        // Routing mobula api call through nextjs BFF
        const mobulaResponse = await fetch(
            host ? `${host}/api/mobula/fetch-token-price` : `/api/mobula/fetch-token-price`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenAddress,
                    chainId,
                }),
            }
        )
        const json = await mobulaResponse.json()

        if (mobulaResponse.ok) {
            let data = {
                price: json.data.price,
                chainId: chainId,
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
