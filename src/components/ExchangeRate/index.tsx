import { AccountType } from '@/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { IExchangeRate } from '@/hooks/useGetExchangeRate'

const ExchangeRate = ({ accountType }: IExchangeRate) => {
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({ accountType })

    const toCurrency = accountType === AccountType.IBAN ? 'EUR' : accountType === AccountType.CLABE ? 'MXN' : 'USD'

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label="Exchange Rate" value={`1 USD`} />
    }

    const displayValue = exchangeRate ? `1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${toCurrency}` : '-'

    return (
        <PaymentInfoRow
            loading={isFetchingRate}
            label="Exchange Rate"
            moreInfoText={`Exchange rates apply when converting to ${toCurrency}`}
            value={displayValue}
        />
    )
}

export default ExchangeRate
