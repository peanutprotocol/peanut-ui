'use client'

import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TransactionCard from '@/components/TransactionDetails/TransactionCard'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useUserStore } from '@/redux/hooks'
import { getHeaderTitle } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * displays the user's transaction history with infinite scrolling.
 */
const HistoryPage = () => {
    const pathname = usePathname()
    const loaderRef = useRef<HTMLDivElement>(null)
    const { user } = useUserStore()
    const currentUserUsername = user?.user.username

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

        if (loaderRef.current) {
            observer.observe(loaderRef.current)
        }

        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    if (isLoading && !historyData?.pages?.length) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return <div className="w-full py-4 text-center">Error loading history: {error?.message}</div>
    }

    const noEntries = !historyData || historyData.pages.every((page) => page.entries.length === 0)

    if (noEntries) {
        return (
            <div className="flex h-[80dvh] flex-col items-center justify-center">
                <NavHeader title={getHeaderTitle(pathname)} />
                <div className="flex flex-grow items-center justify-center">
                    <NoDataEmptyState animSize="lg" message="You haven't done any transactions" />
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            {!!historyData?.pages.length && <NavHeader title={getHeaderTitle(pathname)} />}
            <div className="h-full w-full">
                {historyData?.pages.map((page, pageIndex) => (
                    <div key={pageIndex} className="space-y-0">
                        {page.entries.map((item, itemIndex) => {
                            const { transactionDetails, transactionCardType } = mapTransactionDataForDrawer(
                                item,
                                currentUserUsername || ''
                            )

                            const totalItemsAcrossAllPages = historyData.pages.reduce(
                                (acc, currPage) => acc + currPage.entries.length,
                                0
                            )
                            const currentItemAbsoluteIndex =
                                historyData.pages
                                    .slice(0, pageIndex)
                                    .reduce((acc, currPage) => acc + currPage.entries.length, 0) + itemIndex

                            let position: 'first' | 'middle' | 'last' | undefined = 'middle'
                            if (totalItemsAcrossAllPages === 1) {
                                position = undefined
                            } else if (currentItemAbsoluteIndex === 0) {
                                position = 'first'
                            } else if (currentItemAbsoluteIndex === totalItemsAcrossAllPages - 1) {
                                position = 'last'
                            }

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
                ))}

                <div ref={loaderRef} className="w-full py-4">
                    {isFetchingNextPage && <div className="w-full text-center">Loading more...</div>}
                </div>
            </div>
        </div>
    )
}

export default HistoryPage
