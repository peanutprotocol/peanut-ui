'use server'
import { unstable_cache } from 'next/cache'
import { getExchangeRate } from './exchange-rate'
import { AccountType } from '@/interfaces'
import { mantecaApi } from '@/services/manteca'

export const getCurrencyPrice = unstable_cache(
    async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
        let buy: number
        let sell: number
        currencyCode = currencyCode.toUpperCase()
        switch (currencyCode) {
            case 'USD':
                buy = 1
                sell = 1
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
                    buy = parseFloat(data.buy_rate)
                    sell = parseFloat(data.sell_rate)
                }
                break
            case 'ARS':
            case 'BRL':
            case 'COP':
            case 'CRC':
            case 'PUSD':
            case 'GTQ':
            case 'PHP':
            case 'BOB':
                {
                    const response = await mantecaApi.getPrices({ asset: 'USDC', against: currencyCode })
                    buy = Number(response.effectiveBuy)
                    sell = Number(response.effectiveSell)
                }
                break
            default:
                throw new Error('Unsupported currency')
        }
        return { buy, sell }
    },
    ['getCurrencyPrice'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)
