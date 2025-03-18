'use client'

import { Button } from '@/components/0_Bruddle'
import { useDashboard } from '@/components/Dashboard/useDashboard'
import AddressLink from '@/components/Global/AddressLink'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { ListItemView, TransactionType } from '@/components/Global/ListItemView'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { TransactionBadge } from '@/components/Global/TransactionBadge'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IDashboardItem } from '@/interfaces'
import {
    formatAmount,
    formatDate,
    getChainLogo,
    getHistoryTransactionStatus,
    getTokenLogo,
    isStableCoin,
    printableAddress,
} from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useInfiniteQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { isAddress } from 'viem'

const ITEMS_PER_PAGE = 10

const HistoryPage = () => {
    const { address } = useWallet()
    const { composeLinkDataArray, fetchLinkDetailsAsync } = useDashboard()
    const [dashboardData, setDashboardData] = useState<IDashboardItem[]>([])
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
    const loaderRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let isStale = false
        setIsLoadingDashboard(true)
        composeLinkDataArray(address ?? '').then((data) => {
            if (isStale) return
            setDashboardData(data)
            setIsLoadingDashboard(false)
        })
        return () => {
            isStale = true
        }
    }, [address])

    const fetchHistoryPage = async ({ pageParam = 0 }) => {
        const start = pageParam * ITEMS_PER_PAGE
        const end = start + ITEMS_PER_PAGE
        const pageData = dashboardData.slice(start, end)

        // fetch link details for the current page
        const updatedData = await fetchLinkDetailsAsync(pageData)

        const formattedData = pageData.map((data) => {
            const linkDetails = updatedData.find((item) => item.link === data.link)

            const transactionStatus =
                (linkDetails?.status ?? data.status)
                    ? getHistoryTransactionStatus(data?.type as TransactionType, linkDetails?.status ?? data.status)
                    : undefined

            return {
                id: `${data.link ?? ''}-${data.txHash ?? ''}-${data.date}`,
                transactionType: data.type,
                amount: `${isStableCoin(data.tokenSymbol) ? `$${formatAmount(data.amount)}` : `${formatAmount(data.amount)} ${data.tokenSymbol}`}`,
                recipientAddress: data.address ?? '',
                recipientAddressFormatter: (address: string) => {
                    const sanitizedAddressOrName = isAddress(address) ? printableAddress(address) : address
                    return `To ${sanitizedAddressOrName}`
                },
                status: transactionStatus,
                transactionDetails: {
                    ...data,
                },
            }
        })

        return {
            items: formattedData,
            nextPage: end < dashboardData.length ? pageParam + 1 : undefined,
        }
    }

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, isLoading, error } = useInfiniteQuery({
        queryKey: ['history', address],
        queryFn: fetchHistoryPage,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        enabled: dashboardData.length > 0,
        initialPageParam: 0,
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

    if (isLoadingDashboard || isLoading) {
        return <PeanutLoading />
    }

    if (status === 'error') {
        console.error(error)
        Sentry.captureException(error)
        return <div className="w-full py-4 text-center">Error loading history: {error?.message}</div>
    }

    if (dashboardData.length === 0) {
        return (
            <div className="flex h-[80dvh] items-center justify-center">
                <NoDataEmptyState
                    animSize="lg"
                    message="You haven't done any transactions"
                    cta={
                        <Link href="/home" className="cursor-pointer">
                            <Button shadowSize="4" size="medium" variant={'purple'} className="cursor-pointer">
                                Go to Dashboard
                            </Button>
                        </Link>
                    }
                />
            </div>
        )
    }

    return (
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            <div className="h-full w-full border-t border-n-1">
                {!!data?.pages.length &&
                    data?.pages.map((page, pageIndex) => (
                        <div key={pageIndex}>
                            {page.items.map((item) => (
                                <div key={item.id}>
                                    <ListItemView
                                        id={item.id}
                                        variant="history"
                                        primaryInfo={{
                                            title: (
                                                <div className="flex flex-col items-start gap-2 md:flex-row md:items-center ">
                                                    <div className="font-bold">{item.transactionType}</div>
                                                    <div className="flex flex-col items-end justify-end gap-2 text-end">
                                                        <TransactionBadge status={item.status as string} />
                                                    </div>
                                                </div>
                                            ),
                                            subtitle: !!item.recipientAddress && (
                                                <div
                                                    className="text-xs text-gray-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    To: <AddressLink address={item.recipientAddress} />
                                                </div>
                                            ),
                                        }}
                                        secondaryInfo={{
                                            mainText: item.amount,
                                            subText: item.transactionDetails.date
                                                ? formatDate(new Date(item.transactionDetails.date))
                                                : '',
                                        }}
                                        metadata={{
                                            tokenLogo: getTokenLogo(item.transactionDetails.tokenSymbol),
                                            chainLogo: getChainLogo(item.transactionDetails.chain),
                                        }}
                                        details={item.transactionDetails}
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
