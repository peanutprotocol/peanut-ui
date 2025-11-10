'use client'
import { useInfiniteQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { PEANUT_API_URL } from '@/constants'
import { CONTACTS } from '@/constants/query.consts'
import { fetchWithSentry } from '@/utils'

export interface Contact {
    userId: string
    username: string
    fullName: string | null
    bridgeKycStatus: string | null
    showFullName: boolean
    relationshipTypes: ('inviter' | 'invitee' | 'sent_money' | 'received_money')[]
    firstInteractionDate: string
    lastInteractionDate: string
    transactionCount: number
}

interface ContactsResponse {
    contacts: Contact[]
    total: number
    hasMore: boolean
}

interface UseContactsOptions {
    limit?: number
}

/**
 * hook to fetch all contacts for the current user with infinite scroll
 * includes: inviter, invitees, and all transaction counterparties (sent/received money, request pots)
 */
export function useContacts(options: UseContactsOptions = {}) {
    const { limit = 50 } = options

    const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
        queryKey: [CONTACTS, limit],
        queryFn: async ({ pageParam = 0 }): Promise<ContactsResponse> => {
            const queryParams = new URLSearchParams({
                limit: limit.toString(),
                offset: (pageParam * limit).toString(),
            })

            const response = await fetchWithSentry(`${PEANUT_API_URL}/users/contacts?${queryParams}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch contacts: ${response.statusText}`)
            }

            return response.json()
        },
        getNextPageParam: (lastPage, allPages) => {
            // if hasMore is true, return next page number
            return lastPage.hasMore ? allPages.length : undefined
        },
        initialPageParam: 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // flatten all pages into single contacts array
    const allContacts = data?.pages.flatMap((page) => page.contacts) || []

    return {
        contacts: allContacts,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    }
}
