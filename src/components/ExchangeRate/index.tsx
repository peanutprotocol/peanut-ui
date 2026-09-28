import { useTranslations } from 'next-intl'
import { AccountType } from '@/interfaces/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import useGetExchangeRate, { type IExchangeRate } from '@/hooks/useGetExchangeRate'
import { getOfframpConfigFromAccount } from '@/utils/bridge.utils'

/**
 * The rate row of a Bridge bank payout. The currency comes from the account
 * TYPE, the way the transfer picks it: a UK IBAN is paid EUR, so it shows a
 * EUR rate, never a GBP one (TASK-23054).
 */
const ExchangeRate = ({ accountType }: Omit<IExchangeRate, 'enabled'>) => {
    const t = useTranslations('exchangeRate.row')
    const tCommon = useTranslations('common')
    const { exchangeRate, isFetchingRate } = useGetExchangeRate({ accountType })

    if (accountType === AccountType.US) {
        return <PaymentInfoRow loading={isFetchingRate} label={tCommon('exchangeRate')} value={`1 USD`} />
    }

    const currency = getOfframpConfigFromAccount({ type: accountType }).currency.toUpperCase()
    return (
        <PaymentInfoRow
            loading={isFetchingRate}
            label={tCommon('exchangeRate')}
            moreInfoText={t('appliesWhenConverting', { currency })}
            value={exchangeRate ? `1 USD = ${parseFloat(exchangeRate).toFixed(4)} ${currency}` : '-'}
        />
    )
}

export default ExchangeRate
