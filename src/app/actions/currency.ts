'use server'
import { getExchangeRate } from './exchange-rate'
import { AccountType } from '@/interfaces'
import { mantecaApi } from '@/services/manteca'

const MANTECA_CURRENCIES = ['ARS', 'BRL', 'COP', 'CRC', 'PUSD', 'GTQ', 'PHP', 'BOB']

export const getCurrencyPrice = async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
    let buy: number
    let sell: number
    currencyCode = currencyCode.toUpperCase()
    if (currencyCode === 'USD') {
        buy = 1
        sell = 1
    } else if (['EUR', 'MXN'].includes(currencyCode)) {
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
    } else if (MANTECA_CURRENCIES.includes(currencyCode)) {
        const response = await mantecaApi.getPrices({ asset: 'USDC', against: currencyCode })
        buy = Number(response.effectiveBuy)
        sell = Number(response.effectiveSell)
    } else {
        throw new Error('Invalid currency code')
    }
    return { buy, sell }
}
