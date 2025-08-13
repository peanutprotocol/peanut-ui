import { getExchangeRate } from '@/app/actions/exchange-rate'
import { AccountType } from '@/interfaces'
import { useEffect, useState } from 'react'

export interface IExchangeRate {
    accountType: AccountType
}

/**
 * Used to get exchange rate for a given account type
 * @returns {string, boolean} The exchange rate for the given account type and a boolean indicating if the rate is being fetched
 */
export default function useGetExchangeRate({ accountType }: IExchangeRate) {
    const [exchangeRate, setExchangeRate] = useState<string | null>(null)
    const [isFetchingRate, setIsFetchingRate] = useState(true)

    useEffect(() => {
        const fetchExchangeRate = async () => {
            setIsFetchingRate(true)

            if (accountType === AccountType.US) {
                setExchangeRate('1')
                setIsFetchingRate(false)
                return
            }

            try {
                const { data, error: rateError } = await getExchangeRate(accountType)

                if (rateError) {
                    console.error('Failed to fetch exchange rate:', rateError)
                }

                if (data) {
                    setExchangeRate(data.sell_rate)
                }
            } catch (error) {
                console.error('An error occurred while fetching the exchange rate:', error)
            } finally {
                setIsFetchingRate(false)
            }
        }

        fetchExchangeRate()
    }, [accountType])

    return { exchangeRate, isFetchingRate }
}
