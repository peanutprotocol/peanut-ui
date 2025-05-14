import { fetchWithSentry } from '@/utils'

export const currencyApi = {
    getPrice: async (currencyCode: string): Promise<number> => {
        if (currencyCode === 'USD') return 1
        if (currencyCode !== 'ARS') {
            throw new Error('Unsupported currency')
        }
        const response = await fetchWithSentry('https://dolarapi.com/v1/dolares/cripto')
        const data = await response.json()

        // Average between buy and sell price
        const price = (data.compra + data.venta) / 2

        return price
    },
}
