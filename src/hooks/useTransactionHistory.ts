import { BASE_URL, PEANUT_API_URL, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { TRANSACTIONS } from '@/constants/query.consts'
import { fetchWithSentry, formatAmount, getFromLocalStorage, getTokenDetails } from '@/utils'
import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { formatUnits, type Hash } from 'viem'

type LatestHistoryResult = QueryObserverResult<HistoryResponse>
type InfiniteHistoryResult = InfiniteQueryObserverResult<InfiniteData<HistoryResponse>>

export enum EHistoryEntryType {
    REQUEST = 'REQUEST',
    CASHOUT = 'CASHOUT',
    DEPOSIT = 'DEPOSIT',
    SEND_LINK = 'SEND_LINK',
    DIRECT_SEND = 'DIRECT_SEND',
    WITHDRAW = 'WITHDRAW',
    BRIDGE_OFFRAMP = 'BRIDGE_OFFRAMP',
    BRIDGE_ONRAMP = 'BRIDGE_ONRAMP',
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
    currency?: {
        amount: string
        code: string
    }
    txHash?: string
    chainId: string
    tokenSymbol: string
    tokenAddress: string
    status: string
    userRole: HistoryUserRole
    attachmentUrl?: string
    memo?: string
    cancelledAt?: Date | string
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
    mode?: 'infinite' | 'latest' | 'public'
    limit?: number
    enabled?: boolean
    username?: string
}

export function useTransactionHistory(options: {
    mode: 'latest' | 'public'
    limit?: number
    enabled?: boolean
    username?: string
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
    username,
}: UseTransactionHistoryOptions): LatestHistoryResult | InfiniteHistoryResult {
    const fetchHistory = async ({
        cursor,
        limit,
        isPublic = false,
    }: {
        cursor?: string
        limit: number
        isPublic?: boolean
    }): Promise<HistoryResponse> => {
        const queryParams = new URLSearchParams()
        if (cursor) queryParams.append('cursor', cursor)
        if (limit) queryParams.append('limit', limit.toString())

        let url: string
        if (isPublic) {
            url = `${PEANUT_API_URL}/users/${username}/history?${queryParams.toString()}`
        } else {
            url = `${PEANUT_API_URL}/users/history?${queryParams.toString()}`
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (!isPublic) {
            headers['Authorization'] = `Bearer ${Cookies.get('jwt-token')}`
        }
        const response = await fetchWithSentry(url, { method: 'GET', headers })

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
                    case EHistoryEntryType.SEND_LINK: {
                        const password = getFromLocalStorage(`sendLink::password::${entry.uuid}`)
                        const { contractVersion, depositIdx } = extraData
                        if (password) {
                            link = `${BASE_URL}/claim?c=${entry.chainId}&v=${contractVersion}&i=${depositIdx}#p=${password}`
                        }
                        const tokenDetails = getTokenDetails({
                            tokenAddress: entry.tokenAddress as Hash,
                            chainId: entry.chainId,
                        })
                        usdAmount = formatUnits(BigInt(entry.amount), tokenDetails?.decimals ?? 6)
                        tokenSymbol = tokenDetails?.symbol ?? ''
                        break
                    }
                    case EHistoryEntryType.REQUEST: {
                        link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}?chargeId=${entry.uuid}`
                        tokenSymbol = entry.tokenSymbol
                        usdAmount = entry.amount.toString()
                        break
                    }
                    case EHistoryEntryType.DIRECT_SEND: {
                        link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}?chargeId=${entry.uuid}`
                        tokenSymbol = entry.tokenSymbol
                        usdAmount = entry.amount.toString()
                        break
                    }
                    case EHistoryEntryType.DEPOSIT: {
                        const details = getTokenDetails({
                            tokenAddress: entry.tokenAddress as Hash,
                            chainId: entry.chainId,
                        })
                        tokenSymbol = details?.symbol ?? entry.tokenSymbol

                        if (entry.extraData?.blockNumber) {
                            // direct deposits are always in wei
                            usdAmount = formatUnits(BigInt(entry.amount), PEANUT_WALLET_TOKEN_DECIMALS)
                        } else {
                            usdAmount = entry.amount.toString()
                        }
                        break
                    }
                    case EHistoryEntryType.WITHDRAW:
                    case EHistoryEntryType.BRIDGE_OFFRAMP:
                    case EHistoryEntryType.BRIDGE_ONRAMP: {
                        tokenSymbol = entry.tokenSymbol
                        usdAmount = entry.amount.toString()
                        break
                    }
                    default: {
                        if (entry.amount && !usdAmount) {
                            usdAmount = entry.amount.toString()
                        }
                        tokenSymbol = entry.tokenSymbol
                    }
                }
                return {
                    ...entry,
                    tokenSymbol,
                    timestamp: new Date(entry.timestamp),
                    cancelledAt: entry.cancelledAt ? new Date(entry.cancelledAt) : undefined,
                    extraData: {
                        ...extraData,
                        link,
                        usdAmount: `$${formatAmount(usdAmount)}`,
                    },
                }
            }),
        }
    }

    // Latest transactions mode (for home page)
    if (mode === 'latest') {
        return useQuery({
            queryKey: [TRANSACTIONS, 'latest', { limit }],
            queryFn: () => fetchHistory({ limit }),
            enabled,
            staleTime: 5 * 60 * 1000, // 5 minutes
        })
    }

    if (mode === 'public') {
        return useQuery({
            queryKey: [TRANSACTIONS, 'public', username, { limit }],
            queryFn: () => fetchHistory({ limit, isPublic: true }),
            enabled,
            staleTime: 15 * 1000, // 15 seconds
        })
    }

    // Infinite query mode (for main history page)
    return useInfiniteQuery({
        queryKey: [TRANSACTIONS, 'infinite', { limit }],
        queryFn: ({ pageParam }) => fetchHistory({ cursor: pageParam, limit }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}
