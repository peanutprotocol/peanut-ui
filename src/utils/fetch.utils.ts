import { interfaces } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'
export async function fetchSendDiscordNotification({ message }: { message: string }) {
    const response = await fetch('/api/send-discord-notification', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
        }),
    })

    if (!response.ok) {
        throw new Error('Network response was not ok') //TODO: update error
    }

    const data = await response.json()

    return data
}

export const fetchTokenPrice = async (tokenAddress: string, chainId: string) => {
    try {
        if (tokenAddress.toLowerCase() == '0x0000000000000000000000000000000000000000') {
            tokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        }

        // Routing mobula api call through nextjs BFF
        const mobulaResponse = await fetch('/api/mobula/fetch-token-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tokenAddress,
                chainId,
            }),
        })
        const json = await mobulaResponse.json()

        if (mobulaResponse.ok) {
            let data = {
                price: json.data.price,
                chainId: chainId,
            }
            console.log('fetchTokenPrice', data)
            if (utils.estimateStableCoin(json.data.price)) {
                data.price = 1
            }
            return data
        } else {
            return undefined
        }
    } catch (error) {
        console.log('error fetching token price for token ' + tokenAddress)
        return undefined
    }
}
