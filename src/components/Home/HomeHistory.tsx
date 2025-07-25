'use client'

import Icon from '@/components/Global/Icon'
import { Icon as IconComponent } from '@/components/Global/Icons/Icon'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { BASE_URL } from '@/constants'
import { HistoryEntry, useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { CardPosition, getCardPosition } from '../Global/Card'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { KycStatusItem } from '../Kyc/KycStatusItem'
import { isKycStatusItem, KycHistoryEntry } from '@/hooks/useKycFlow'
import { KYCStatus } from '@/utils'
import { Button } from '../0_Bruddle'
import { useRouter } from 'next/navigation'

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
    const kycStatus: KYCStatus = user?.user?.kycStatus || 'not_started'
    const router = useRouter()

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
            const entries: Array<HistoryEntry | KycHistoryEntry> = [...historyData.entries]

            // process websocket entries: update existing or add new ones
            // Sort by timestamp ascending to process oldest entries first
            const sortedWsEntries = [...wsHistoryEntries].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
            sortedWsEntries.forEach((wsEntry) => {
                const existingIndex = entries.findIndex((entry) => entry.uuid === wsEntry.uuid)

                if (existingIndex !== -1) {
                    // update existing entry with latest websocket data
                    if (wsEntry.extraData) {
                        wsEntry.extraData.usdAmount = wsEntry.amount.toString()
                    } else {
                        wsEntry.extraData = { usdAmount: wsEntry.amount.toString() }
                    }
                    wsEntry.extraData.link = `${BASE_URL}/${wsEntry.recipientAccount.username || wsEntry.recipientAccount.identifier}?chargeId=${wsEntry.uuid}`
                    entries[existingIndex] = wsEntry
                } else {
                    // add new entry if it doesn't exist
                    if (wsEntry.extraData) {
                        wsEntry.extraData.usdAmount = wsEntry.amount.toString()
                    } else {
                        wsEntry.extraData = { usdAmount: wsEntry.amount.toString() }
                    }
                    wsEntry.extraData.link = `${BASE_URL}/${wsEntry.recipientAccount.username || wsEntry.recipientAccount.identifier}?chargeId=${wsEntry.uuid}`
                    entries.push(wsEntry)
                }
            })

            // Add KYC status item if applicable and not on a public page
            if (user?.user?.kycStatus && user.user.kycStatus !== 'not_started' && user.user.kycStartedAt && !isPublic) {
                entries.push({
                    isKyc: true,
                    timestamp: user.user.kycStartedAt,
                    uuid: 'kyc-status-item',
                })
            }

            // Sort entries by date in descending order
            entries.sort((a, b) => {
                const dateA = new Date(a.timestamp || 0).getTime()
                const dateB = new Date(b.timestamp || 0).getTime()
                return dateB - dateA
            })

            // Limit to the most recent entries
            setCombinedEntries(entries.slice(0, isPublic ? 20 : 5))
        }
    }, [historyData, wsHistoryEntries, isPublic, user])

    const pendingRequests = useMemo(() => {
        if (!combinedEntries.length) return []
        return combinedEntries.filter(
            (entry) =>
                !isKycStatusItem(entry) &&
                entry.type === 'REQUEST' &&
                entry.userRole === 'SENDER' &&
                entry.status === 'NEW'
        )
    }, [combinedEntries])

    // if the txn history is private and user is not logged in or the username is not the same as the username in the url, show the join peanut button
    if (!isPublic && (!isLoggedIn || user?.user.username !== username)) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-sm border-2 border-black bg-white p-4">
                <h2 className="text-lg font-extrabold">Join Peanut!</h2>
                <p className="text-center">Send and receive payments in seconds with your own Peanut account.</p>

                <Button
                    variant="purple"
                    shadowSize="4"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-sm"
                    onClick={() => router.push('/setup')}
                >
                    <IconComponent size={16} name="user-plus" fill="black" />
                    <span className="font-bold">Create Account</span>
                </Button>
            </div>
        )
    }

    // show loading state
    if (isLoading) {
        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">Transactions</h2>
                <div className="flex flex-col">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <HistorySkeleton key={index} position={getCardPosition(index, 5)} />
                    ))}
                </div>
            </div>
        )
    }

    // show error state
    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <h2 className="text-base font-bold">Recent Transactions</h2>{' '}
                <EmptyState icon="alert" title="Error loading transactions!" description="Please try again later" />
            </div>
        )
    }

    // show empty state if no transactions exist
    if (!combinedEntries.length) {
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                {kycStatus !== 'not_started' && (
                    <div className="space-y-3">
                        <h2 className="text-base font-bold">Activity</h2>
                        <KycStatusItem position="single" />
                    </div>
                )}

                <h2 className="text-base font-bold">Recent Transactions</h2>
                <EmptyState
                    icon="txn-off"
                    title="No transactions yet!"
                    description="Start by sending or requesting money"
                />
            </div>
        )
    }

    return (
        <div className={twMerge('mx-auto w-full space-y-3 md:max-w-2xl md:space-y-3', isLoggedIn ? 'pb-4' : 'pb-0')}>
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
                    <h2 className="text-base font-bold">Activity</h2>
                    <Icon width={30} height={30} name="arrow-next" />
                </Link>
            )}
            {/* container for the transaction cards */}
            <div className="h-full w-full">
                {/* map over the latest entries and render transactioncard */}
                {combinedEntries
                    .filter((item) => !pendingRequests.some((r) => r.uuid === item.uuid))
                    .map((item, index) => {
                        // filter out pending requests to calculate correct card position
                        const filteredEntries = combinedEntries.filter(
                            (entry) => !pendingRequests.some((r) => r.uuid === entry.uuid)
                        )
                        const position = getCardPosition(index, filteredEntries.length)

                        // Render KYC status item if it's its turn in the sorted list
                        if (isKycStatusItem(item)) {
                            return <KycStatusItem key={item.uuid} position={position} />
                        }

                        // map the raw history entry to the format needed by the ui components
                        const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(item)

                        // determine card position for styling (first, middle, last, single)

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

export const HistorySkeleton = ({ position }: { position: CardPosition }) => {
    return (
        <Card position={position} className="flex items-center justify-between gap-3">
            <div className="h-8 w-8 min-w-8 animate-pulse rounded-full bg-grey-2" />
            <div className="w-full space-y-2.5">
                <div className="h-4.5 w-full animate-pulse rounded-full bg-grey-2" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-grey-2" />
            </div>
        </Card>
    )
}
