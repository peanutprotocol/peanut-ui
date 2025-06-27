import { useEffect, useState } from 'react'
import { getExchangeRate } from '@/app/actions/exchange-rate'
import { AccountType } from '@/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'

interface ExchangeRateProps {
    accountType: AccountType
}

const ExchangeRate = ({ accountType }: ExchangeRateProps) => {
    const [exchangeRate, setExchangeRate] = useState<string | null>(null)
    const [isFetchingRate, setIsFetchingRate] = useState(true)

    useEffect(() => {
        const fetchExchangeRate = async () => {
            setIsFetchingRate(true)
            try {
                const { data, error: rateError } = await getExchangeRate(accountType)
                console.log('data', data)

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

    const toCurrency = accountType === AccountType.IBAN ? 'EUR' : accountType === AccountType.CLABE ? 'MXN' : 'USD'

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label="Exchange Rate" value={`1 USD`} />
    }

    if (exchangeRate) {
        return (
            <PaymentInfoRow
                loading={isFetchingRate}
                label="Exchange Rate"
                moreInfoText={`Exchange rates apply when converting to ${toCurrency}`}
                value={`1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${toCurrency}`}
            />
        )
    }

    return null
}

export default ExchangeRate
