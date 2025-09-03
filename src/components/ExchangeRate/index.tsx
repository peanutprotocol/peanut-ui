import { AccountType } from '@/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { IExchangeRate } from '@/hooks/useGetExchangeRate'
import { useExchangeRate } from '@/hooks/useExchangeRate'

interface IExchangeRateProps extends Omit<IExchangeRate, 'enabled'> {
    nonEruoCurrency?: string
}

const ExchangeRate = ({ accountType, nonEruoCurrency }: IExchangeRateProps) => {
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({ accountType, enabled: !nonEruoCurrency })
    const { exchangeRate: nonEruoExchangeRate, isLoading } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: nonEruoCurrency || 'EUR',
        initialSourceAmount: 1,
        enabled: !!nonEruoCurrency,
    })

    const toCurrency = accountType === AccountType.IBAN ? 'EUR' : accountType === AccountType.CLABE ? 'MXN' : 'USD'

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label="Exchange Rate" value={`1 USD`} />
    }

    let displayValue = '-'
    let isLoadingRate = false
    let moreInfoText = ''

    if (nonEruoCurrency) {
        displayValue = nonEruoExchangeRate
            ? `1 USD = ${parseFloat(nonEruoExchangeRate.toString()).toFixed(4)} ${nonEruoCurrency}`
            : '-'
        isLoadingRate = isLoading
        moreInfoText =
            "This is an approximate value. The actual amount received may vary based on your bank's exchange rate"
    } else {
        displayValue = exchangeRate ? `1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${toCurrency}` : '-'
        isLoadingRate = isFetchingRate
        moreInfoText = `Exchange rates apply when converting to ${toCurrency}`
    }

    return (
        <PaymentInfoRow
            loading={isLoadingRate}
            label="Exchange Rate"
            moreInfoText={moreInfoText}
            value={displayValue}
        />
    )
}

export default ExchangeRate
