'use client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CONTACTS } from '@/constants/query.consts'
import { getContacts } from '@/app/actions/users'
import { type Contact, type ContactsResponse } from '@/interfaces'

export type { Contact }

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
            const result = await getContacts({
                limit,
                offset: pageParam * limit,
            })

            if (result.error) {
                throw new Error(result.error)
            }

            if (!result.data) {
                throw new Error('No data returned from server')
            }

            return result.data
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
