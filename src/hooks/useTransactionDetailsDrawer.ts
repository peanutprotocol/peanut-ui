import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useState } from 'react'
export const useTransactionDetailsDrawer = () => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetails | null>(null)

    const openTransactionDetails = (transaction: TransactionDetails) => {
        setSelectedTransaction(transaction)
        setIsDrawerOpen(true)
    }

    const closeTransactionDetails = () => {
        setIsDrawerOpen(false)
    }

    return {
        isDrawerOpen,
        selectedTransaction,
        openTransactionDetails,
        closeTransactionDetails,
    }
}
