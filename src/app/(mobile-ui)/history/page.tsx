'use client'

import { type CardPosition } from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { KycStatusItem } from '@/components/Kyc/KycStatusItem'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useUserStore } from '@/redux/hooks'
import { formatGroupHeaderDate, getDateGroup, getDateGroupKey } from '@/utils/dateGrouping.utils'
import * as Sentry from '@sentry/nextjs'
import { isKycStatusItem } from '@/hooks/useBridgeKycFlow'
import React, { useEffect, useMemo, useRef } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { TRANSACTIONS } from '@/constants/query.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import type { HistoryResponse } from '@/hooks/useTransactionHistory'
import { AccountType } from '@/interfaces'
import { completeHistoryEntry } from '@/utils/history.utils'
import { formatUnits } from 'viem'

/**
 * displays the user's transaction history with infinite scrolling and date grouping.
 */
const HistoryPage = () => {
    const loaderRef = useRef<HTMLDivElement>(null)
    const { user } = useUserStore()
    const queryClient = useQueryClient()

    const {
        data: historyData,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isLoading,
        error,
        isError,
    } = useTransactionHistory({
        mode: 'infinite',
        limit: 20,
    })

    // Real-time updates via WebSocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        onHistoryEntry: async (newEntry) => {
            console.log('[History] New transaction received via WebSocket:', newEntry)

            // Process the entry through completeHistoryEntry to format amounts and add computed fields
            // This ensures WebSocket entries match the format of API-fetched entries
            let completedEntry
            try {
                completedEntry = await completeHistoryEntry(newEntry)
            } catch (error) {
                console.error('[History] Failed to process WebSocket entry:', error)
                Sentry.captureException(error, {
                    tags: { feature: 'websocket-history' },
                    extra: { entryType: newEntry.type, entryUuid: newEntry.uuid },
                })

                // Fallback: Use raw entry with proper amount formatting
                let fallbackAmount = newEntry.amount.toString()

                if (newEntry.type === 'DEPOSIT' && newEntry.extraData?.blockNumber) {
                    try {
                        fallbackAmount = formatUnits(BigInt(newEntry.amount), PEANUT_WALLET_TOKEN_DECIMALS)
                    } catch (formatError) {
                        console.error('[History fallback] Failed to format deposit amount:', formatError)
                        fallbackAmount = '0.00' // Safer than showing wei
                    }
                }

                completedEntry = {
                    ...newEntry,
                    timestamp: new Date(newEntry.timestamp),
                    extraData: {
                        ...newEntry.extraData,
                        usdAmount: fallbackAmount,
                    },
                }
            }

            // Update TanStack Query cache with processed transaction
            queryClient.setQueryData<InfiniteData<HistoryResponse>>(
                [TRANSACTIONS, 'infinite', { limit: 20 }],
                (oldData) => {
                    if (!oldData) return oldData

                    // Check if entry exists on ANY page to prevent duplicates
                    const existsAnywhere = oldData.pages.some((p) =>
                        p.entries.some((e) => e.uuid === completedEntry.uuid)
                    )

                    if (existsAnywhere) {
                        console.log('[History] Duplicate transaction ignored:', completedEntry.uuid)
                        return oldData
                    }

                    // Add new entry to the first page
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page, index) => {
                            if (index === 0) {
                                return {
                                    ...page,
                                    entries: [completedEntry, ...page.entries],
                                }
                            }
                            return page
                        }),
                    }
                }
            )

            // Invalidate balance query to refresh it (scoped to user's wallet address)
            const walletAddress = user?.accounts.find(
                (account) => account.type === AccountType.PEANUT_WALLET
            )?.identifier
            if (walletAddress) {
                queryClient.invalidateQueries({ queryKey: ['balance', walletAddress] })
            }
        },
    })

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage()
                }
            },
            {
                threshold: 0.1,
            }
        )
        const currentLoaderRef = loaderRef.current
        if (currentLoaderRef) {
            observer.observe(currentLoaderRef)
        }
        return () => {
            if (currentLoaderRef) {
                observer.unobserve(currentLoaderRef)
            }
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const allEntries = useMemo(() => historyData?.pages.flatMap((page) => page.entries) ?? [], [historyData])

    const combinedAndSortedEntries = useMemo(() => {
        if (isLoading) {
            return []
        }
        const entries: Array<any> = [...allEntries]

        if (user) {
            if (user.user?.bridgeKycStatus && user.user.bridgeKycStatus !== 'not_started') {
                entries.push({
                    isKyc: true,
                    timestamp: user.user.bridgeKycStartedAt ?? user.user.createdAt ?? new Date().toISOString(),
                    uuid: 'bridge-kyc-status-item',
                    bridgeKycStatus: user.user.bridgeKycStatus,
                })
            }
            user.user.kycVerifications?.forEach((verification) => {
                entries.push({
                    isKyc: true,
                    timestamp: verification.approvedAt ?? verification.updatedAt ?? verification.createdAt,
                    uuid: verification.providerUserId ?? `${verification.provider}-${verification.mantecaGeo}`,
                    verification,
                })
            })
        }

        entries.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime()
            const dateB = new Date(b.timestamp || 0).getTime()
            return dateB - dateA
        })

        return entries
    }, [allEntries, user, isLoading])

    if (isLoading && combinedAndSortedEntries.length === 0) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <h2 className="text-base font-bold">Transactions</h2>{' '}
                <EmptyState icon="alert" title="Error loading transactions!" description="Please contact support." />
            </div>
        )
    }

    if (!isLoading && combinedAndSortedEntries.length === 0) {
        return (
            <div className="flex h-[80dvh] flex-col items-center justify-center">
                <NavHeader title={'Activity'} />
                <div className="flex flex-grow items-center justify-center">
                    <NoDataEmptyState animSize="lg" message="You haven't done any transactions" />
                </div>
            </div>
        )
    }

    let lastGroupHeaderKey: string | null = null
    const today = new Date()

    return (
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            <NavHeader title={'Activity'} />
            <div className="h-full w-full">
                {combinedAndSortedEntries.map((item, index) => {
                    const itemDate = new Date(item.timestamp)
                    const group = getDateGroup(itemDate, today)
                    const currentGroupHeaderKey = getDateGroupKey(itemDate, group)
                    const showHeader = currentGroupHeaderKey !== lastGroupHeaderKey
                    if (showHeader) {
                        lastGroupHeaderKey = currentGroupHeaderKey
                    }

                    let position: CardPosition = 'middle'
                    const isFirstOverall = index === 0
                    const isLastOverall = index === combinedAndSortedEntries.length - 1
                    const isFirstInGroup = showHeader

                    if (combinedAndSortedEntries.length === 1) {
                        position = 'single'
                    } else if (isFirstInGroup && isLastOverall) {
                        position = 'single'
                    } else if (isFirstInGroup || isFirstOverall) {
                        position = 'first'
                    } else if (isLastOverall) {
                        position = 'last'
                    }

                    return (
                        <React.Fragment key={item.uuid}>
                            {showHeader && (
                                <div className="mb-2 mt-4 px-1 text-sm font-semibold capitalize">
                                    {formatGroupHeaderDate(itemDate, group, today)}
                                </div>
                            )}
                            {isKycStatusItem(item) ? (
                                <KycStatusItem
                                    position={position}
                                    verification={item.verification}
                                    bridgeKycStatus={item.bridgeKycStatus}
                                    bridgeKycStartedAt={
                                        item.bridgeKycStatus ? user?.user.bridgeKycStartedAt : undefined
                                    }
                                />
                            ) : (
                                (() => {
                                    const { transactionDetails, transactionCardType } =
                                        mapTransactionDataForDrawer(item)
                                    return (
                                        <TransactionCard
                                            type={transactionCardType}
                                            name={transactionDetails.userName}
                                            amount={transactionDetails.amount ? Number(transactionDetails.amount) : 0}
                                            status={transactionDetails.status}
                                            initials={transactionDetails.initials}
                                            transaction={transactionDetails}
                                            position={position}
                                            haveSentMoneyToUser={transactionDetails.haveSentMoneyToUser}
                                        />
                                    )
                                })()
                            )}
                        </React.Fragment>
                    )
                })}

                <div ref={loaderRef} className="w-full py-4">
                    {isFetchingNextPage && <div className="w-full text-center">Loading more...</div>}
                </div>
            </div>
        </div>
    )
}

export default HistoryPage
