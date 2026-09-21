'use client'

import type React from 'react'
import NavHeader from '@/components/Global/NavHeader'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ReceiptUnavailable } from '@/components/TransactionDetails/ReceiptUnavailable'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useAuth } from '@/context/authContext'

export function PublicReceiptPage({
    state,
    transaction,
    children,
}: {
    state?: 'gone' | 'loadFailed'
    transaction?: TransactionDetails
    /** Owner view: the client refetches the entry so the shared PDF cache never sees a cookie. */
    children?: React.ReactNode
}) {
    const { user, isFetchingUser } = useAuth()
    const isAuthenticated = Boolean(user?.user.userId)
    const showPublicIssuer = !isFetchingUser && !isAuthenticated

    return (
        <PageContainer className="receipt-page flex min-h-dvh flex-col items-center p-4">
            {isAuthenticated && (
                <div className="print:hidden">
                    <NavHeader titleKey="receipt" />
                </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col items-center py-4">
                {state ? (
                    <div className="m-auto">
                        <ReceiptUnavailable variant={state} />
                    </div>
                ) : children ? (
                    <div className="my-auto w-full">{children}</div>
                ) : transaction ? (
                    <div className="my-auto w-full">
                        <TransactionDetailsReceipt
                            className="w-full"
                            transaction={transaction}
                            isPublic
                            showPublicIssuer={showPublicIssuer}
                        />
                    </div>
                ) : null}
            </div>
        </PageContainer>
    )
}
