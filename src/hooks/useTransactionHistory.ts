import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { QueryObserverResult, InfiniteQueryObserverResult, InfiniteData } from '@tanstack/react-query'
import { fetchWithSentry, getFromLocalStorage, getTokenDetails } from '@/utils'
import { PEANUT_API_URL, BASE_URL } from '@/constants'
import Cookies from 'js-cookie'
import { formatUnits } from 'viem'
import type { Hash } from 'viem'

type LatestHistoryResult = QueryObserverResult<HistoryResponse>
type InfiniteHistoryResult = InfiniteQueryObserverResult<InfiniteData<HistoryResponse>>

export enum EHistoryEntryType {
    REQUEST = 'REQUEST',
    CASHOUT = 'CASHOUT',
    DEPOSIT = 'DEPOSIT',
    SEND_LINK = 'SEND_LINK',
    DIRECT_SEND = 'DIRECT_SEND',
}

export enum EHistoryUserRole {
    SENDER = 'SENDER',
    RECIPIENT = 'RECIPIENT',
    BOTH = 'BOTH',
    NONE = 'NONE',
}

export type HistoryEntryType = `${EHistoryEntryType}`
export type HistoryUserRole = `${EHistoryUserRole}`

export type HistoryEntry = {
    uuid: string
    type: HistoryEntryType
    timestamp: Date
    amount: string
    txHash?: string
    chainId: string
    tokenSymbol: string
    tokenAddress: string
    status: string
    userRole: HistoryUserRole
    attachmentUrl?: string
    senderAccount?:
        | {
              identifier: string
              type: string
              isUser: boolean
              username?: string | undefined
              fullName?: string
              userId?: string
          }
        | undefined
    recipientAccount: {
        identifier: string
        type: string
        isUser: boolean
        username?: string | undefined
        fullName?: string
        userId?: string
    }
    extraData?: Record<string, any>
}

export type HistoryResponse = {
    entries: HistoryEntry[]
    cursor?: string
    hasMore: boolean
}

// Hook options
type UseTransactionHistoryOptions = {
    mode?: 'infinite' | 'latest'
    limit?: number
    enabled?: boolean
}

export function useTransactionHistory(options: {
    mode: 'latest'
    limit?: number
    enabled?: boolean
}): LatestHistoryResult

export function useTransactionHistory(options: {
    mode?: 'infinite'
    limit?: number
    enabled?: boolean
}): InfiniteHistoryResult

/**
 * A flexible hook for fetching transaction history with two modes:
 * - 'infinite': For the main history page with infinite scrolling
 * - 'latest': For showing the most recent transactions on the home page
 */
export function useTransactionHistory({
    mode = 'infinite',
    limit = 50,
    enabled = true,
}: UseTransactionHistoryOptions): LatestHistoryResult | InfiniteHistoryResult {
    const fetchHistory = async ({ cursor, limit }: { cursor?: string; limit: number }): Promise<HistoryResponse> => {
        const queryParams = new URLSearchParams()
        if (cursor) queryParams.append('cursor', cursor)
        if (limit) queryParams.append('limit', limit.toString())

        const url = `${PEANUT_API_URL}/users/history?${queryParams.toString()}`

        const response = await fetchWithSentry(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch history: ${response.statusText}`)
        }

        const data = await response.json()

        // Convert ISO strings to Date objects for timestamps
        return {
            ...data,
            entries: data.entries.map((entry: HistoryEntry) => {
                const extraData = entry.extraData ?? {}
                let link: string = ''
                let tokenSymbol: string = ''
                let usdAmount: string = ''
                switch (entry.type) {
                    case 'SEND_LINK':
                        const password = getFromLocalStorage(`sendLink::password::${entry.uuid}`)
                        const { contractVersion, depositIdx } = extraData
                        link = `${BASE_URL}/claim?c=${entry.chainId}&v=${contractVersion}&i=${depositIdx}#p=${password}`
                        const tokenDetails = getTokenDetails({
                            tokenAddress: entry.tokenAddress as Hash,
                            chainId: entry.chainId,
                        })
                        usdAmount = formatUnits(BigInt(entry.amount), tokenDetails?.decimals ?? 6)
                        tokenSymbol = tokenDetails?.symbol ?? ''
                        break
                    case 'REQUEST':
                        link = `${process.env.NEXT_PUBLIC_BASE_URL}/request/pay?id=${entry.uuid}`
                        tokenSymbol = entry.tokenSymbol
                        usdAmount = entry.amount.toString()
                        break
                    default:
                        break
                }
                return {
                    ...entry,
                    tokenSymbol,
                    timestamp: new Date(entry.timestamp),
                    extraData: {
                        ...extraData,
                        link,
                        usdAmount: `$${usdAmount}`,
                    },
                }
            }),
        }
    }

    // Latest transactions mode (for home page)
    if (mode === 'latest') {
        return useQuery({
            queryKey: ['transactions', 'latest', { limit }],
            queryFn: () => fetchHistory({ limit }),
            enabled,
            staleTime: 5 * 60 * 1000, // 5 minutes
        })
    }

    // Infinite query mode (for main history page)
    return useInfiniteQuery({
        queryKey: ['transactions', 'infinite', { limit }],
        queryFn: ({ pageParam }) => fetchHistory({ cursor: pageParam, limit }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}
