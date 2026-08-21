import { useTranslations } from 'next-intl'
import { AccountType } from '@/interfaces/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { type IExchangeRate } from '@/hooks/useGetExchangeRate'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/hooks/useCurrency'
import { applyBridgeCrossCurrencyFee } from '@/utils/bridge.utils'

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

    const toCurrency = accountType === AccountType.IBAN ? 'EUR' : accountType === AccountType.CLABE ? 'MXN' : 'USD'

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

    // calculate local currency amount if provided
    // apply the cross-currency developer fee (currently 0 — identity; kept for
    // the planned FX-margin re-enable) so the displayed "amount you will
    // receive" tracks what Bridge actually delivers if the fee returns.
    // NOTE: this component is used for Bridge offramp / bank-claim flows where the
    // on-chain source is always USDC (even though the UI sourceCurrency prop defaults
    // to 'USD' for display/rate-fetch purposes). Pass 'USDC' explicitly to the fee
    // helper — it mirrors backend `getBridgeDeveloperFeeParams` where 'usd' is the
    // fee-free fiat rail and 'usdc' is the stablecoin side that a re-enabled fee
    // would apply to when crossing currencies.
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
                label={tCommon('exchangeRate')}
                moreInfoText={moreInfoText}
                value={displayValue}
            />
            {localCurrencyAmount && (
                <PaymentInfoRow
                    loading={isLoadingRate}
                    label={t('amountYouReceive')}
                    value={`~ ${currencySymbol}${localCurrencyAmount}`}
                    moreInfoText={t('approximate')}
                />
            )}
        </>
    )
}

export default ExchangeRate
