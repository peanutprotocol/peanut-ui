'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { type TransactionDetails } from './transactionTransformer'
import { useRepeatPayment } from './useRepeatPayment'

/**
 * The receipt's one secondary CTA: Send again or Withdraw again (TASK-25462).
 * Its own component so the auth and Pix-route reads mount only on receipts
 * that can repeat (`canRepeatPayment`). Renders nothing when no saved account
 * matches the payout.
 */
export function RepeatPaymentButton({ transaction }: { transaction: TransactionDetails }) {
    const t = useAppTranslations('transaction')
    const repeat = useRepeatPayment(transaction)
    if (!repeat) return null
    return (
        <Button
            variant="secondary"
            shadowSize="4"
            className="w-full"
            icon="retry"
            onClick={repeat.run}
            data-testid="repeat-payment"
        >
            {t(repeat.labelKey)}
        </Button>
    )
}
