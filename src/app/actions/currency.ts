'use server'
import { unstable_cache } from 'next/cache'
import { fetchWithSentry } from '@/utils'
import { getExchangeRate } from './exchange-rate'
import { AccountType } from '@/interfaces'

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
        let price: number
        currencyCode = currencyCode.toUpperCase()
        switch (currencyCode) {
            case 'USD':
                price = 1
                break
            case 'EUR':
            case 'MXN':
                {
                    let accountType: AccountType
                    if (currencyCode === 'EUR') {
                        accountType = AccountType.IBAN
                    } else if (currencyCode === 'MXN') {
                        accountType = AccountType.CLABE
                    } else {
                        throw new Error('Invalid currency code')
                    }
                    const { data, error } = await getExchangeRate(accountType)
                    if (error) {
                        throw new Error('Failed to fetch exchange rate from bridge')
                    }
                    if (!data) {
                        throw new Error('No data returned from exchange rate API')
                    }
                    price = parseFloat(data.buy_rate)
                }
                break
            case 'ARS':
                {
                    const response = await fetchWithSentry('https://dolarapi.com/v1/dolares/cripto')
                    const data = await response.json()

                    if (!data.compra || !data.venta) {
                        throw new Error('Invalid response from dolarapi')
                    }

                    // Average between buy and sell price
                    price = (data.compra + data.venta) / 2
                }
                break
            default:
                throw new Error('Unsupported currency')
        }
        return price
    },
    ['getCurrencyPrice'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)
