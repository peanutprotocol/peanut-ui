'use client'

import AddressLink from '@/components/Global/AddressLink'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { ListItemView } from '@/components/Global/ListItemView'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { TransactionBadge } from '@/components/Global/TransactionBadge'
import { formatDate, getChainLogo, getHeaderTitle, getTokenLogo, getChainName } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'

const HistoryPage = () => {
    const pathname = usePathname()
    const loaderRef = useRef<HTMLDivElement>(null)
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

    if (!historyData || historyData.pages.length === 0) {
        return (
            <div className="flex h-[80dvh] items-center justify-center">
                <NoDataEmptyState animSize="lg" message="You haven't done any transactions" />
            </div>
        )
    }

    return (
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            {!!historyData?.pages.length ? <NavHeader title={getHeaderTitle(pathname)} /> : null}
            <div className="h-full w-full border-t border-n-1">
                {!!historyData?.pages.length &&
                    historyData?.pages.map((page, pageIndex) => (
                        <div key={pageIndex}>
                            {page.entries.map((item) => (
                                <div key={item.uuid}>
                                    <ListItemView
                                        id={item.uuid}
                                        variant="history"
                                        primaryInfo={{
                                            title: (
                                                <div className="flex flex-col items-start gap-2 md:flex-row md:items-center ">
                                                    <div className="font-bold">
                                                        {item.type} {item.userRole}
                                                    </div>
                                                    <div className="flex flex-col items-end justify-end gap-2 text-end">
                                                        <TransactionBadge status={item.status as string} />
                                                    </div>
                                                </div>
                                            ),
                                            subtitle: !!item.recipientAccount.identifier && (
                                                <div
                                                    className="text-xs text-gray-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    To: <AddressLink address={item.recipientAccount.identifier} />
                                                </div>
                                            ),
                                        }}
                                        secondaryInfo={{
                                            mainText: item.extraData?.usdAmount,
                                            subText: item.timestamp ? formatDate(new Date(item.timestamp)) : '',
                                        }}
                                        metadata={{
                                            tokenLogo: getTokenLogo(item.tokenSymbol),
                                            chainLogo: getChainLogo(getChainName(item.chainId) ?? ''),
                                        }}
                                        details={item}
                                    />
                                </div>
                            ))}
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
