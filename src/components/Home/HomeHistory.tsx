'use client'

import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { EHistoryEntryType, type HistoryEntry, useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useUserStore } from '@/redux/hooks'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Card, { type CardPosition, getCardPosition } from '../Global/Card'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { KycStatusItem } from '../Kyc/KycStatusItem'
import { isKycStatusItem, type KycHistoryEntry } from '@/hooks/useBridgeKycFlow'
import { useWallet } from '@/hooks/wallet/useWallet'
import { BadgeStatusItem, isBadgeHistoryItem } from '@/components/Badges/BadgeStatusItem'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { completeHistoryEntry } from '@/utils/history.utils'
import { formatUnits } from 'viem'
import { useHaptic } from 'use-haptic'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { Icon } from '../Global/Icons/Icon'

/**
 * component to display a preview of the most recent transactions on the home page.
 */
const HomeHistory = ({ username, hideTxnAmount = false }: { username?: string; hideTxnAmount?: boolean }) => {
    const { user } = useUserStore()
    const isLoggedIn = !!user?.user.userId || false
    // Only filter when user is requesting for some different user's history
    const filterMutualTxs = username !== user?.user.username
    const {
        data: historyData,
        isLoading,
        isError,
        error,
    } = useTransactionHistory({ mode: 'latest', limit: 5, username, filterMutualTxs, enabled: isLoggedIn })
    // check if the username is the same as the current user
    const { fetchBalance } = useWallet()
    const { triggerHaptic } = useHaptic()
    const { fetchUser } = useAuth()

    const isViewingOwnHistory = useMemo(
        () => (isLoggedIn && !username) || (isLoggedIn && username === user?.user.username),
        [isLoggedIn, username, user?.user.username]
    )

    // WebSocket for real-time updates
    const { historyEntries: wsHistoryEntries } = useWebSocket({
        username, // Pass the username to the WebSocket hook
        onHistoryEntry: useCallback(
            (entry: HistoryEntry) => {
                // for direct send and completed requests, fetch the balance
                if (
                    entry.type === EHistoryEntryType.DIRECT_SEND ||
                    (entry.type === EHistoryEntryType.REQUEST && entry.status.toUpperCase() === 'COMPLETED')
                ) {
                    fetchBalance()
                }
            },
            [fetchBalance]
        ),
        onKycStatusUpdate: useCallback(
            async (newStatus: string) => {
                // refetch user data when kyc status changes so the status item appears immediately
                console.log('KYC status updated via WebSocket:', newStatus)
                await fetchUser()
            },
            [fetchUser]
        ),
    })

    // Combine fetched history with real-time updates
    const [combinedEntries, setCombinedEntries] = useState<Array<any>>([])

    // get all the user ids from the combined entries to check for interactions
    const userIds = useMemo(() => {
        if (!combinedEntries.length) return []
        return Array.from(
            new Set(
                combinedEntries
                    .map((entry) => {
                        if (isKycStatusItem(entry)) return null
                        if (entry.userRole === 'SENDER') return entry.recipientAccount.userId
                        if (entry.userRole === 'RECIPIENT') return entry.senderAccount?.userId
                        return null
                    })
                    .filter((userId) => userId) as string[]
            )
        )
    }, [combinedEntries])

    // fetch the interaction status for the user ids
    const { interactions } = useUserInteractions(userIds)

    useEffect(() => {
        if (!isLoading && historyData?.entries) {
            let cancelled = false

            // Process entries asynchronously to handle completeHistoryEntry
            const processEntries = async () => {
                // Start with the fetched entries
                const entries: Array<HistoryEntry | KycHistoryEntry> = [...historyData.entries]

                // inject badge entries using user's badges (newest first) and earnedAt chronology
                if (isViewingOwnHistory) {
                    const badges = user?.user?.badges ?? []
                    badges.forEach((b) => {
                        if (!b.earnedAt) return
                        entries.push({
                            isBadge: true,
                            uuid: b.id,
                            timestamp: new Date(b.earnedAt).toISOString(),
                            code: b.code,
                            name: b.name,
                            description: b.description ?? undefined,
                            iconUrl: b.iconUrl ?? undefined,
                        } as any)
                    })
                }

                // process websocket entries: update existing or add new ones
                // Sort by timestamp ascending to process oldest entries first
                const sortedWsEntries = [...wsHistoryEntries].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )

                // Process WebSocket entries through completeHistoryEntry to format amounts correctly
                for (const wsEntry of sortedWsEntries) {
                    // Check cancellation before processing each entry
                    if (cancelled) return

                    let completedEntry
                    try {
                        completedEntry = await completeHistoryEntry(wsEntry)
                    } catch (error) {
                        console.error('[HomeHistory] Failed to process WebSocket entry:', error)
                        Sentry.captureException(error, {
                            tags: { feature: 'websocket-home-history' },
                            extra: { entryType: wsEntry.type, entryUuid: wsEntry.uuid },
                        })

                        // Fallback: Use raw entry with proper amount formatting
                        let fallbackAmount = wsEntry.amount.toString()

                        if (wsEntry.type === 'DEPOSIT' && wsEntry.extraData?.blockNumber) {
                            try {
                                fallbackAmount = formatUnits(BigInt(wsEntry.amount), PEANUT_WALLET_TOKEN_DECIMALS)
                            } catch (formatError) {
                                console.error('[HomeHistory fallback] Failed to format deposit amount:', formatError)
                                fallbackAmount = '0.00' // Safer than showing wei
                            }
                        }

                        completedEntry = {
                            ...wsEntry,
                            timestamp: new Date(wsEntry.timestamp),
                            extraData: {
                                ...wsEntry.extraData,
                                usdAmount: fallbackAmount,
                            },
                        }
                    }

                    const existingIndex = entries.findIndex((entry) => entry.uuid === completedEntry.uuid)

                    if (existingIndex !== -1) {
                        // update existing entry with latest websocket data
                        entries[existingIndex] = completedEntry
                    } else {
                        // add new entry if it doesn't exist
                        entries.push(completedEntry)
                    }
                }

                // Add KYC status item if applicable and the user is
                // viewing their own history
                if (isViewingOwnHistory) {
                    if (user?.user?.bridgeKycStatus && user.user.bridgeKycStatus !== 'not_started') {
                        entries.push({
                            isKyc: true,
                            timestamp: user.user.bridgeKycStartedAt ?? user.user.createdAt ?? new Date().toISOString(),
                            uuid: 'bridge-kyc-status-item',
                            bridgeKycStatus: user.user.bridgeKycStatus,
                        })
                    }
                    user?.user.kycVerifications?.forEach((verification) => {
                        entries.push({
                            isKyc: true,
                            timestamp: verification.approvedAt ?? verification.updatedAt ?? verification.createdAt,
                            uuid: verification.providerUserId ?? `${verification.provider}-${verification.mantecaGeo}`,
                            verification,
                        })
                    })
                }

                // Check cancellation before setting state
                if (cancelled) return

                // Sort entries by date in descending order
                entries.sort((a, b) => {
                    const dateA = new Date(a.timestamp || 0).getTime()
                    const dateB = new Date(b.timestamp || 0).getTime()
                    return dateB - dateA
                })

                // Limit to the most recent entries
                setCombinedEntries(entries.slice(0, 5))
            }

            processEntries()

            // Cleanup function to prevent state updates after unmount
            return () => {
                cancelled = true
            }
        }
    }, [historyData, wsHistoryEntries, user, isLoading, isViewingOwnHistory])

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

    // show loading state
    if (isLoading) {
        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">Activity</h2>
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
                <h2 className="text-base font-bold">Activity</h2>{' '}
                <EmptyState icon="alert" title="Error loading activity!" description="Please contact Support." />
            </div>
        )
    }

    // show empty state if no transactions exist
    if (!isLoading && !combinedEntries.length) {
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <h2 className="text-base font-bold">Activity</h2>
                {isViewingOwnHistory &&
                    ((user?.user.bridgeKycStatus && user?.user.bridgeKycStatus !== 'not_started') ||
                        (user?.user.kycVerifications && user?.user.kycVerifications.length > 0)) && (
                        <div className="space-y-3">
                            {user?.user.bridgeKycStatus && user?.user.bridgeKycStatus !== 'not_started' && (
                                <KycStatusItem
                                    position="single"
                                    bridgeKycStatus={user.user.bridgeKycStatus}
                                    bridgeKycStartedAt={user.user.bridgeKycStartedAt}
                                />
                            )}
                            {user?.user.kycVerifications?.map((verification) => (
                                <KycStatusItem
                                    key={
                                        verification.providerUserId ??
                                        `${verification.provider}-${verification.mantecaGeo}`
                                    }
                                    position="single"
                                    verification={verification}
                                />
                            ))}
                        </div>
                    )}

                {isViewingOwnHistory &&
                    !user?.user.bridgeKycStatus &&
                    (!user?.user.kycVerifications || user?.user.kycVerifications.length === 0) && (
                        <EmptyState
                            icon="txn-off"
                            title="No activity yet!"
                            description="Start by sending or requesting money"
                        />
                    )}

                {!isViewingOwnHistory && (
                    <EmptyState
                        icon="txn-off"
                        title="No transactions yet!"
                        description="Start by sending or requesting money"
                    />
                )}
            </div>
        )
    }

    return (
        <div className={twMerge('mx-auto w-full space-y-3 md:max-w-2xl md:space-y-3', isLoggedIn ? 'pb-4' : 'pb-0')}>
            {/* link to the full history page */}
            {pendingRequests.length > 0 && (
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
                                    haveSentMoneyToUser={transactionDetails.haveSentMoneyToUser}
                                />
                            )
                        })}
                    </div>
                </>
            )}
            {!isViewingOwnHistory ? (
                <h2 className="text-base font-bold">Latest Transactions</h2>
            ) : (
                <Link href="/history" className="flex items-center justify-between" onClick={() => triggerHaptic()}>
                    <h2 className="text-base font-bold">Activity</h2>
                    <Icon name="chevron-up" size={30} className="rotate-90" />
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
                            return (
                                <KycStatusItem
                                    key={item.uuid}
                                    position={position}
                                    verification={item.verification}
                                    bridgeKycStatus={item.bridgeKycStatus}
                                    bridgeKycStartedAt={
                                        item.bridgeKycStatus ? user?.user.bridgeKycStartedAt : undefined
                                    }
                                />
                            )
                        }

                        // render badge milestone entries
                        if (isBadgeHistoryItem(item)) {
                            return <BadgeStatusItem key={item.uuid} position={position} entry={item} />
                        }

                        // map the raw history entry to the format needed by the ui components
                        const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(item)

                        // determine card position for styling (first, middle, last, single)

                        const haveSentMoneyToUser =
                            item.userRole === 'SENDER'
                                ? interactions[item.recipientAccount.userId]
                                : item.senderAccount?.userId
                                  ? interactions[item.senderAccount.userId]
                                  : false

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
                                haveSentMoneyToUser={haveSentMoneyToUser}
                                hideTxnAmount={hideTxnAmount}
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
