import { useTranslations } from 'next-intl'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { formatBankAmount } from '@/utils/currency'

interface RecipientGetsRowProps {
    amount: string
    /** ISO code of the bank amount, any case. */
    currency: string
    loading?: boolean
}

/**
 * The bank amount a payout is expected to deliver, in one wording for every
 * money-out screen: "≈" and a note, because the provider converts at
 * settlement (TASK-23054).
 */
const RecipientGetsRow = ({ amount, currency, loading }: RecipientGetsRowProps) => {
    const t = useTranslations('exchangeRate.row')
    return (
        <PaymentInfoRow
            loading={loading}
            label={t('recipientGets')}
            value={`≈ ${formatBankAmount(amount, currency)}`}
            moreInfoText={t('approximate')}
        />
    )
}

export default RecipientGetsRow
