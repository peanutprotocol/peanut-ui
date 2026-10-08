import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Drawer, DrawerContent } from '../Global/Drawer'
import { TransactionDetailsReceipt } from './TransactionDetailsReceipt'

interface TransactionDetailsDrawerProps {
    isOpen: boolean
    onClose: () => void
    /** the transaction data to display, or null if none selected. */
    transaction: TransactionDetails | null
    transactionAmount?: string // dollarized amount of the transaction
    avatarUrl?: string
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
    avatarUrl,
}) => {
    const t = useTranslations('transaction')
    // ref for the main content area to calculate dynamic height
    const contentRef = useRef<HTMLDivElement>(null)
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        }
    }, [onClose])

    // A reused drawer can retain its previous scroll offset. Reset whenever a
    // receipt opens or changes so the top avatar/flag never starts underneath
    // the scroll clip.
    useEffect(() => {
        if (isOpen && scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0
    }, [isOpen, transaction?.id])

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
            {/* The bottom padding sits on the receipt, INSIDE the scroll box, not on the
                sheet: the footer link's 44px hit area bleeds 14px past its text row, and
                outside the scroll box that bleed alone made the drawer scrollable by 14px
                with nothing to scroll — enough for a flick to slide the avatar under the
                handle band and slice it in half. The drawer chrome owns the space above
                (handle 8px top / 24px below, per board).
                No z-index shuffle for the cancel confirmation any more: it is a vaul
                NestedRoot now, so vaul stacks it above this drawer and scales this one
                back on its own. */}
            <DrawerContent accessibleTitle={t('drawerTitle')} scrollAreaRef={scrollAreaRef}>
                <TransactionDetailsReceipt
                    isLoading={isLoading}
                    transaction={transaction}
                    onClose={handleClose}
                    setIsLoading={setIsLoading}
                    contentRef={contentRef}
                    transactionAmount={transactionAmount}
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    avatarUrl={avatarUrl}
                    className="pb-4"
                />
            </DrawerContent>
        </Drawer>
    )
}
