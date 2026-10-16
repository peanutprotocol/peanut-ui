'use client'

import type React from 'react'
import { useSyncExternalStore } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ReceiptUnavailable } from '@/components/TransactionDetails/ReceiptUnavailable'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useAuth } from '@/context/authContext'

type ReceiptAuthState = 'loading' | 'anonymous' | 'authenticated'
const subscribeAuthSnapshot = () => () => {}

export function PublicReceiptPage({
    state,
    transaction,
    children,
    initialAuthState = 'loading',
}: {
    state?: 'gone' | 'loadFailed'
    transaction?: TransactionDetails
    /** Owner view: the client refetches the entry so the shared PDF cache never sees a cookie. */
    children?: React.ReactNode
    /** Serialized server state; the production user query starts pending with no cached user. */
    initialAuthState?: ReceiptAuthState
}) {
    const { user, isFetchingUser } = useAuth()
    const liveAuthState: ReceiptAuthState = user?.user.userId
        ? 'authenticated'
        : isFetchingUser
          ? 'loading'
          : 'anonymous'
    const authState = useSyncExternalStore(
        subscribeAuthSnapshot,
        () => liveAuthState,
        () => initialAuthState
    )
    const isAuthenticated = authState === 'authenticated'
    const showPublicIssuer = authState === 'anonymous'

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
