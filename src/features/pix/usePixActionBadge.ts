'use client'

import { useTranslations } from 'next-intl'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

/**
 * The badge of a Pix withdrawal whose payout the bank refused: the user can
 * name another own Pix key now, so the badge names that action (design.md, rows
 * the user cannot act on), never Failed. Undefined for any other entry, which
 * keeps its normal status word.
 */
export function usePixActionBadge(
    transaction: Pick<TransactionDetails, 'extraDataForDrawer'> | null
): string | undefined {
    const t = useTranslations('pix.recovery')
    return transaction?.extraDataForDrawer?.awaitsNewPixKey ? t('actionNeeded') : undefined
}
