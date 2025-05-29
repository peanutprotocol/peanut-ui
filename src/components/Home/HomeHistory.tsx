'use client'

import Icon from '@/components/Global/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { getCardPosition } from '../Global/Card'
import { BASE_URL } from '@/constants'

/**
 * component to display a preview of the most recent transactions on the home page.
 */
const HomeHistory = ({ isPublic = false, username }: { isPublic?: boolean; username?: string }) => {
    const { user } = useUserStore()
    const isLoggedIn = !!user?.user.userId || false
    // fetch the latest 5 transaction history entries
    const mode = isPublic ? 'public' : 'latest'
    const limit = isPublic ? 20 : 5
    const { data: historyData, isLoading, isError, error } = useTransactionHistory({ mode, limit, username })

    // WebSocket for real-time updates
    const { historyEntries: wsHistoryEntries } = useWebSocket({
        username, // Pass the username to the WebSocket hook
        onHistoryEntry: useCallback(() => {
            // Optionally show a toast or notification when new entries arrive
        }, []),
    })

    // Combine fetched history with real-time updates
    const [combinedEntries, setCombinedEntries] = useState<Array<any>>([])

    useEffect(() => {
        if (historyData?.entries) {
            // Start with the fetched entries
            const entries = [...historyData.entries]

            // Add any WebSocket entries that aren't already in the list
            wsHistoryEntries.forEach((wsEntry) => {
                if (!entries.some((entry) => entry.uuid === wsEntry.uuid)) {
                    if (wsEntry.extraData) {
                        wsEntry.extraData.usdAmount = wsEntry.amount.toString()
                    } else {
                        wsEntry.extraData = { usdAmount: wsEntry.amount.toString() }
                    }
                    wsEntry.extraData.link = `${BASE_URL}/${wsEntry.recipientAccount.username || wsEntry.recipientAccount.identifier}?chargeId=${wsEntry.uuid}`
                    entries.unshift(wsEntry)
                }
            })

            // Limit to the most recent entries
            setCombinedEntries(entries.slice(0, isPublic ? 20 : 5))
        }
    }, [historyData, wsHistoryEntries, isPublic])

    const pendingRequests = useMemo(() => {
        if (!combinedEntries.length) return []
        return combinedEntries.filter(
            (entry) => entry.type === 'REQUEST' && entry.userRole === 'SENDER' && entry.status === 'NEW'
        )
    }, [combinedEntries])

    // show loading state
    if (isLoading) {
        return <PeanutLoading />
    }

    // show error state
    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return <div className="w-full py-4 text-center">error loading history: {error?.message}</div>
    }

    // show empty state if no transactions exist
    if (!combinedEntries.length) {
        return (
            <div className="mx-auto mt-6 w-full space-y-2 md:max-w-2xl md:space-y-3">
                <h2 className="text-base font-bold">transactions</h2> {/* use lowercase consistent with history page */}
                <div className="h-full w-full border-t border-n-1 py-8 text-center">
                    <p className="text-sm text-gray-500">no transactions yet</p>
                </div>
            </div>
        )
    }

    return (
        <div
            className={twMerge(
                'mx-auto w-full space-y-3 pb-28 md:max-w-2xl md:space-y-3',
                isLoggedIn ? 'pb-28' : 'pb-0'
            )}
        >
            {/* link to the full history page */}
            {pendingRequests.length > 0 && !isPublic && (
                <>
                    <h2 className="text-base font-bold">Pending transactions</h2>
                    <div className="h-full w-full">
                        {/* map over the latest entries and render transactioncard */}
                        {pendingRequests.map((item, index) => {
                            // map the raw history entry to the format needed by the ui components
                            const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(item)

                            // determine card position for styling (first, middle, last, single)
                            const position = getCardPosition(index, pendingRequests.length)

                            return (
                                <TransactionCard
                                    key={item.uuid}
                                    type={transactionCardType}
                                    name={transactionDetails.userName}
                                    amount={Number(transactionDetails.amount)}
                                    status={transactionDetails.status}
                                    initials={transactionDetails.initials}
                                    transaction={transactionDetails}
                                    position={position}
                                    isPending={true}
                                />
                            )
                        })}
                    </div>
                </>
            )}
            {isPublic ? (
                <h2 className="text-base font-bold">Latest Transactions</h2>
            ) : (
                <Link href="/history" className="flex items-center justify-between">
                    <h2 className="text-base font-bold">Transactions</h2>
                    <Icon width={30} height={30} name="arrow-next" />
                </Link>
            )}
            {/* container for the transaction cards */}
            <div className="h-full w-full">
                {/* map over the latest entries and render transactioncard */}
                {combinedEntries
                    .filter((item) => !pendingRequests.some((r) => r.uuid === item.uuid))
                    .map((item, index) => {
                        // map the raw history entry to the format needed by the ui components
                        const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(item)

                        // determine card position for styling (first, middle, last, single)
                        const filteredEntries = combinedEntries.filter(
                            (entry) => !pendingRequests.some((r) => r.uuid === entry.uuid)
                        )
                        const position = getCardPosition(index, filteredEntries.length)

                        return (
                            <TransactionCard
                                key={item.uuid}
                                type={transactionCardType}
                                name={transactionDetails.userName}
                                amount={Number(transactionDetails.amount)}
                                status={transactionDetails.status}
                                initials={transactionDetails.initials}
                                transaction={transactionDetails}
                                position={position}
                            />
                        )
                    })}
            </div>
        </div>
    )
}

export default HomeHistory
