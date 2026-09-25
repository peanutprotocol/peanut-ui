import { useTranslations } from 'next-intl'
import { AccountType } from '@/interfaces/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { type IExchangeRate } from '@/hooks/useGetExchangeRate'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import RecipientGetsRow from './RecipientGetsRow'

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
    const t = useTranslations('exchangeRate.row')
    const tCommon = useTranslations('common')
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({ accountType, enabled: !nonEuroCurrency })
    const { exchangeRate: nonEruoExchangeRate, isLoading } = useExchangeRate({
        sourceCurrency,
        destinationCurrency: nonEuroCurrency || 'EUR',
        initialSourceAmount: 1,
        enabled: !!nonEuroCurrency,
    })

    const toCurrency =
        accountType === AccountType.IBAN
            ? 'EUR'
            : accountType === AccountType.CLABE
              ? 'MXN'
              : accountType === AccountType.CO_BANK_TRANSFER
                ? 'COP'
                : 'USD'

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label={tCommon('exchangeRate')} value={`1 USD`} />
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
        moreInfoText = t('approximate')
    } else {
        displayValue = exchangeRate ? `1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${toCurrency}` : '-'
        isLoadingRate = isFetchingRate
        rate = exchangeRate ? parseFloat(exchangeRate) : null
        moreInfoText = t('appliesWhenConverting', { currency: toCurrency })
    }

    const currency = nonEuroCurrency || toCurrency

    // Estimate of the local currency amount. The flows here (bank claims, USD
    // withdrawals, unquotable amounts) create unquoted transfers, which carry
    // no Peanut FX margin: the server sets Bridge fees, and a margin exists
    // only inside a `fixed_output` quote's rate (useBridgeOfframpQuote).
    let localCurrencyAmount: string | null = null
    if (amountToConvert && rate && rate > 0) {
        const amount = parseFloat(amountToConvert)
        if (!isNaN(amount) && amount > 0) {
            localCurrencyAmount = (amount * rate).toFixed(2)
        }
    }

    return (
        <>
            <PaymentInfoRow
                loading={isLoadingRate}
                label={tCommon('exchangeRate')}
                moreInfoText={moreInfoText}
                value={displayValue}
            />
            {localCurrencyAmount && (
                <RecipientGetsRow loading={isLoadingRate} amount={localCurrencyAmount} currency={currency} />
            )}
        </>
    )
}

export default ExchangeRate
