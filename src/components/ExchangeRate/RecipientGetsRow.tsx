import { useTranslations } from 'next-intl'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { formatBankAmount } from '@/utils/currency'

interface RecipientGetsRowProps {
    amount: string
    /** ISO code of the bank amount, any case. */
    currency: string
    loading?: boolean
    /**
     * The transfer pays out exactly `amount` (a `fixed_output` offramp quote).
     * Says nothing about the rate: it is not locked before the transfer exists.
     */
    isExact?: boolean
}

/**
 * The bank amount a payout is expected to deliver, in one wording for every
 * money-out screen: "≈" and a note, because the provider converts at
 * settlement (TASK-23054) — unless the transfer fixes the amount.
 */
const RecipientGetsRow = ({ amount, currency, loading, isExact = false }: RecipientGetsRowProps) => {
    const t = useTranslations('exchangeRate.row')
    return (
        <PaymentInfoRow
            loading={loading}
            label={t('recipientGets')}
            value={isExact ? formatBankAmount(amount, currency) : `≈ ${formatBankAmount(amount, currency)}`}
            moreInfoText={isExact ? undefined : t('approximate')}
        />
    )
}

export default RecipientGetsRow
