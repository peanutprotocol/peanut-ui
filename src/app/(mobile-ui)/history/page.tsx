'use client'

import { CardPosition } from '@/components/Global/Card'
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
import { usePathname } from 'next/navigation'
import { isKycStatusItem } from '@/hooks/useKycFlow'
import React, { useEffect, useMemo, useRef } from 'react'

/**
 * displays the user's transaction history with infinite scrolling and date grouping.
 */
const HistoryPage = () => {
    const pathname = usePathname()
    const loaderRef = useRef<HTMLDivElement>(null)
    const { user } = useUserStore()

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
        const entries: Array<any> = [...allEntries]

        if (user?.user?.kycStatus && user.user.kycStatus !== 'not_started' && user.user.kycStartedAt) {
            entries.push({
                isKyc: true,
                timestamp: user.user.kycStartedAt,
                uuid: 'kyc-status-item',
            })
        }

        entries.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime()
            const dateB = new Date(b.timestamp || 0).getTime()
            return dateB - dateA
        })

        return entries
    }, [allEntries, user])

    if (isLoading && combinedAndSortedEntries.length === 0) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <h2 className="text-base font-bold">Transactions</h2>{' '}
                <EmptyState icon="alert" title="Error loading transactions!" description="Please try again later" />
            </div>
        )
    }

    if (combinedAndSortedEntries.length === 0) {
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
                                <KycStatusItem position={position} />
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
