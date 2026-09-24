import { useTranslations } from 'next-intl'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { formatBankAmount } from '@/utils/currency'

interface RecipientGetsRowProps {
    amount: string
    /** ISO code of the bank amount, any case. */
    currency: string
    /** True when the provider pays exactly this; false when it converts at settlement. */
    exact: boolean
    loading?: boolean
}

/**
 * The bank amount a payout delivers, in one wording for every money-out
 * screen: the amount alone when it is exact, "≈" and a note when it is an
 * estimate (TASK-23054).
 */
const RecipientGetsRow = ({ amount, currency, exact, loading }: RecipientGetsRowProps) => {
    const t = useTranslations('exchangeRate.row')
    const formatted = formatBankAmount(amount, currency)
    return (
        <PaymentInfoRow
            loading={loading}
            label={t('recipientGets')}
            value={exact ? formatted : `≈ ${formatted}`}
            moreInfoText={exact ? undefined : t('approximate')}
        />
    )
}

export default RecipientGetsRow
