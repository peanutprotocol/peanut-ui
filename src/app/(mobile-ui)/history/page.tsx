'use client'

import { ARBITRUM_ICON } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import { useDashboard } from '@/components/Dashboard/useDashboard'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { ListItemView, TransactionType } from '@/components/Global/ListItemView'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IDashboardItem } from '@/interfaces'
import {
    formatAmountWithSignificantDigits,
    formatDate,
    getHeaderTitle,
    printableAddress,
    getTokenLogo,
    getChainLogo,
} from '@/utils'
import { useInfiniteQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isAddress } from 'viem'

const ITEMS_PER_PAGE = 10

const HistoryPage = () => {
    const pathname = usePathname()
    const { address } = useWallet()
    const { composeLinkDataArray, fetchLinkDetailsAsync } = useDashboard()
    const [dashboardData, setDashboardData] = useState<IDashboardItem[]>([])
    const loaderRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let isStale = false
        composeLinkDataArray(address ?? '').then((data) => {
            if (isStale) return
            setDashboardData(data)
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
            return {
                id: `${data.link ?? ''}-${data.txHash ?? ''}-${data.date}`,
                transactionType: data.type,
                amount: `$${formatAmountWithSignificantDigits(Number(data.amount), 2)}`,
                recipientAddress: data.address ?? '',
                recipientAddressFormatter: (address: string) => {
                    const sanitizedAddressOrName = isAddress(address) ? printableAddress(address) : address
                    return `To ${sanitizedAddressOrName}`
                },
                status: linkDetails?.status ?? data.status ?? '',
                transactionDetails: {
                    ...data,
                    status: linkDetails?.status ?? data.status,
                },
            }
        })

        return {
            items: formattedData,
            nextPage: end < dashboardData.length ? pageParam + 1 : undefined,
        }
    }

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, isLoading } = useInfiniteQuery({
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

    if (isLoading) {
        return <PeanutLoading />
    }

    if (status === 'error') {
        return <div className="w-full py-4 text-center">Error loading history</div>
    }

    if (!data?.pages.length) {
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
            {!!data?.pages.length ? <NavHeader title={getHeaderTitle(pathname)} /> : null}
            <div className="h-full w-full">
                {!!data?.pages.length &&
                    data?.pages.map((page, pageIndex) => (
                        <div key={pageIndex} className="border-b border-n-1">
                            {page.items.map((item) => (
                                <div key={item.id}>
                                    <ListItemView
                                        id={item.id}
                                        variant="history"
                                        primaryInfo={{
                                            title: item.transactionType,
                                        }}
                                        secondaryInfo={{
                                            mainText: item.amount,
                                        }}
                                        metadata={{
                                            tokenLogo: getTokenLogo(item.transactionDetails.tokenSymbol),
                                            chainLogo:
                                                item.transactionDetails.chain === 'Arbitrum One'
                                                    ? ARBITRUM_ICON
                                                    : getChainLogo(item.transactionDetails.chain),
                                            subText: item.transactionDetails.date
                                                ? formatDate(new Date(item.transactionDetails.date))
                                                : '',
                                            recipientAddress: item.recipientAddress,
                                            recipientAddressFormatter: item.recipientAddressFormatter,
                                            transactionType: item.transactionType as TransactionType,
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
