import { AccountType } from '@/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { type IExchangeRate } from '@/hooks/useGetExchangeRate'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/hooks/useCurrency'
import { applyBridgeCrossCurrencyFee } from '@/utils/bridge.utils'

// constants for exchange rate messages, specific to ExchangeRate component
const APPROXIMATE_VALUE_MESSAGE =
    "This is an approximate value. The actual amount received may vary based on your bank's exchange rate"
const LOCAL_CURRENCY_LABEL = 'Amount you will receive'

interface IExchangeRateProps extends Omit<IExchangeRate, 'enabled'> {
    nonEuroCurrency?: string
    sourceCurrency?: string
    amountToConvert?: string
}

const ExchangeRate = ({
    accountType,
    nonEuroCurrency,
    sourceCurrency = 'USD',
    amountToConvert,
}: IExchangeRateProps) => {
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({ accountType, enabled: !nonEuroCurrency })
    const { exchangeRate: nonEruoExchangeRate, isLoading } = useExchangeRate({
        sourceCurrency,
        destinationCurrency: nonEuroCurrency || 'EUR',
        initialSourceAmount: 1,
        enabled: !!nonEuroCurrency,
    })

    const toCurrency = accountType === AccountType.IBAN ? 'EUR' : accountType === AccountType.CLABE ? 'MXN' : 'USD'

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label="Exchange Rate" value={`1 USD`} />
    }

    let displayValue = '-'
    let isLoadingRate = false
    let moreInfoText = ''
    let rate: number | null = null

    if (nonEuroCurrency) {
        displayValue = nonEruoExchangeRate
            ? `1 ${sourceCurrency} = ${parseFloat(nonEruoExchangeRate.toString()).toFixed(4)} ${nonEuroCurrency}`
            : '-'
        isLoadingRate = isLoading
        rate = nonEruoExchangeRate
        moreInfoText = APPROXIMATE_VALUE_MESSAGE
    } else {
        displayValue = exchangeRate ? `1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${toCurrency}` : '-'
        isLoadingRate = isFetchingRate
        rate = exchangeRate ? parseFloat(exchangeRate) : null
        moreInfoText = `Exchange rates apply when converting to ${toCurrency}`
    }

    const currency = nonEuroCurrency || toCurrency

    // calculate local currency amount if provided
    // bake in the 0.5% Bridge developer fee for cross-currency pairs so the
    // displayed "amount you will receive" matches what Bridge actually delivers.
    // NOTE: this component is used for Bridge offramp / bank-claim flows where the
    // on-chain source is always USDC (even though the UI sourceCurrency prop defaults
    // to 'USD' for display/rate-fetch purposes). Pass 'USDC' explicitly to the fee
    // helper — it mirrors backend `getBridgeDeveloperFeeParams` where 'usd' is the
    // fee-free fiat rail and 'usdc' is the stablecoin that incurs the 0.5% fee when
    // crossing currencies.
    let localCurrencyAmount: string | null = null
    if (amountToConvert && rate && rate > 0) {
        const amount = parseFloat(amountToConvert)
        if (!isNaN(amount) && amount > 0) {
            const gross = amount * rate
            const net = applyBridgeCrossCurrencyFee(gross, 'USDC', currency)
            localCurrencyAmount = net.toFixed(2)
        }
    }
    const currencySymbol = SYMBOLS_BY_CURRENCY_CODE[currency] || currency

    return (
        <>
            <PaymentInfoRow
                loading={isLoadingRate}
                label="Exchange Rate"
                moreInfoText={moreInfoText}
                value={displayValue}
            />
            {localCurrencyAmount && (
                <PaymentInfoRow
                    loading={isLoadingRate}
                    label={LOCAL_CURRENCY_LABEL}
                    value={`~ ${currencySymbol}${localCurrencyAmount}`}
                    moreInfoText={APPROXIMATE_VALUE_MESSAGE}
                />
            )}
        </>
    )
}

export default ExchangeRate
