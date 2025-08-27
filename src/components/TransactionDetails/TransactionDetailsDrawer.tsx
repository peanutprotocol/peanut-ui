import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import React, { useCallback, useRef, useState } from 'react'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { TransactionDetailsReceipt } from './TransactionDetailsReceipt'

interface TransactionDetailsDrawerProps {
    isOpen: boolean
    onClose: () => void
    /** the transaction data to display, or null if none selected. */
    transaction: TransactionDetails | null
    transactionAmount?: string // dollarized amount of the transaction
}

/**
 * a bottom drawer component that displays detailed information about a specific transaction.
 * includes header, details card, and conditional qr/sharing options for pending transactions.
 */
export const TransactionDetailsDrawer: React.FC<TransactionDetailsDrawerProps> = ({
    isOpen,
    onClose,
    transaction,
    transactionAmount,
}) => {
    // ref for the main content area to calculate dynamic height
    const contentRef = useRef<HTMLDivElement>(null)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        }
    }, [onClose])

    if (!transaction) return null

    return (
        <Drawer
            open={isOpen}
            onOpenChange={(isOpen: boolean) => {
                if (!isOpen && !isModalOpen) {
                    handleClose()
                }
            }}
        >
            <DrawerContent className="p-5">
                <TransactionDetailsReceipt
                    isLoading={isLoading}
                    transaction={transaction}
                    onClose={handleClose}
                    setIsLoading={setIsLoading}
                    contentRef={contentRef}
                    transactionAmount={transactionAmount}
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                />
            </DrawerContent>
        </Drawer>
    )
}
