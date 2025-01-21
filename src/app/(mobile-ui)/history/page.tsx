'use client'

import { ARBITRUM_ICON } from '@/assets'
import { useDashboard } from '@/components/Dashboard/useDashboard'
import { ListItemView, TransactionType } from '@/components/Global/ListItemView'
import * as utils from '@/utils'

import NavHeader from '@/components/Global/NavHeader'
import { PEANUT_API_URL } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IDashboardItem } from '@/interfaces'
import { formatAmountWithSignificantDigits, printableAddress } from '@/utils'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

const ITEMS_PER_PAGE = 10

const HistoryPage = () => {
    const { address } = useWallet()
    const { composeLinkDataArray, fetchLinkDetailsAsync, removeRequestLinkFromLocalStorage } = useDashboard()
    const [dashboardData, setDashboardData] = useState<IDashboardItem[]>([])
    const loaderRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const data = composeLinkDataArray(address ?? '')
        setDashboardData(data)
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
                id: (data.link ?? data.txHash ?? '') + Math.random(),
                transactionType: data.type,
                amount: `$ ${formatAmountWithSignificantDigits(Number(data.amount), 2)}`,
                recipientAddress: data.address ? `To ${printableAddress(data.address)}` : '',
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

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
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

    const handleDeleteLink = async (link: string) => {
        const url = new URL(link ?? '')
        const id = url.searchParams.get('id')

        removeRequestLinkFromLocalStorage(link)

        await fetch(`${PEANUT_API_URL}/request-links/${id}/cancel`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: process.env.PEANUT_API_KEY,
            }),
        })
    }

    if (status === 'error') {
        return <div className="w-full py-4 text-center">Error loading history</div>
    }

    return (
        <div className="mx-auto w-full space-y-6 md:max-w-2xl md:space-y-3">
            <NavHeader title="History" />
            <div className="w-full">
                {data?.pages.map((page, pageIndex) => (
                    <div key={pageIndex}>
                        {data?.pages.map((page, pageIndex) => (
                            <div key={pageIndex}>
                                {page.items.map((item) => (
                                    <div key={item.id} className="border-b border-n-1">
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
                                                tokenLogo:
                                                    item.transactionDetails.tokenSymbol === 'USDC'
                                                        ? 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040'
                                                        : undefined,
                                                chainLogo:
                                                    item.transactionDetails.chain === 'Arbitrum One'
                                                        ? ARBITRUM_ICON
                                                        : undefined,
                                                subText: item.transactionDetails.date
                                                    ? utils.formatDate(new Date(item.transactionDetails.date))
                                                    : '',
                                                recipientAddress: item.recipientAddress,
                                                transactionType: item.transactionType as TransactionType,
                                            }}
                                            details={item.transactionDetails}
                                        />
                                    </div>
                                ))}
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
