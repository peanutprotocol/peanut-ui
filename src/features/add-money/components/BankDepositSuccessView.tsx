'use client'

import { useMemo } from 'react'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { formatBankAmount } from '@/utils/currency'
import type { HistoryEntry } from '@/utils/history.utils'

/**
 * The crypto deposit's success screen for a Bridge one-time transfer: "Added $X", the local amount under it, and the receipt
 * Activity shows for the same entry.
 */
export function BankDepositSuccessView({ entry, redirectTo }: { entry: HistoryEntry; redirectTo: string }) {
    const receipt = useMemo(() => mapTransactionDataForDrawer(entry).transactionDetails, [entry])
    const local = receipt.currency
    return (
        <PaymentSuccessView
            type="DEPOSIT"
            usdAmount={receipt.amount.toString()}
            secondaryAmount={
                local && local.code.toUpperCase() !== 'USD'
                    ? formatBankAmount(local.amount, local.code.toUpperCase())
                    : undefined
            }
            transactionDetails={receipt}
            redirectTo={redirectTo}
        />
    )
}
