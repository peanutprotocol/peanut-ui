'use client'

import type React from 'react'
import { useSyncExternalStore } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { AppShell } from '@/components/Global/AppShell'
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

    if (state) {
        return (
            <AppShell variant="app" contentClassName="flex flex-col" innerClassName="flex-1 items-stretch">
                <PageStack className="receipt-page flex-1">
                    {isAuthenticated && (
                        <div className="print:hidden">
                            <NavHeader titleKey="receipt" />
                        </div>
                    )}
                    <PageStack.Center>
                        <ReceiptUnavailable variant={state} />
                    </PageStack.Center>
                </PageStack>
            </AppShell>
        )
    }

    return (
        <PageContainer className="receipt-page flex min-h-dvh flex-col items-center p-4">
            {isAuthenticated && (
                <div className="print:hidden">
                    <NavHeader titleKey="receipt" />
                </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col items-center py-4">
                {children ? (
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
