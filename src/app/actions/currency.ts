'use server'
import { unstable_cache } from 'next/cache'
import { fetchWithSentry } from '@/utils'

const SUPPORTED_CURRENCIES_DETAILS = {
    ARS: {
        apiURL: 'https://dolarapi.com/v1/dolares/cripto',
    },
    BRL: {
        apiURL: 'https://br.dolarapi.com/v1/cotacoes/usd',
    },
}

export const getCurrencyPrice = unstable_cache(
    async (currencyCode: string): Promise<number> => {
        if (currencyCode === 'USD') return 1

        const currencyDetails = SUPPORTED_CURRENCIES_DETAILS[currencyCode as keyof typeof SUPPORTED_CURRENCIES_DETAILS]
        if (!currencyDetails) {
            throw new Error('Unsupported currency')
        }
        const response = await fetchWithSentry(currencyDetails.apiURL)
        const data = await response.json()

        const buy = data.compra
        const sell = data.venta || data.venda

        if (!buy || !sell) {
            throw new Error('Invalid response from dolarapi')
        }

        // Average between buy and sell price
        const price = (buy + sell) / 2

        return price
    },
    ['getCurrencyPrice'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)
