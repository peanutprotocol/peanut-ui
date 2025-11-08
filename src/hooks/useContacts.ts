'use client'
import { useQuery } from '@tanstack/react-query'
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
    offset?: number
}

/**
 * hook to fetch all contacts for the current user with pagination
 * includes: inviter, invitees, and all transaction counterparties (sent/received money, request pots)
 */
export function useContacts(options: UseContactsOptions = {}) {
    const { limit = 100, offset = 0 } = options

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: [CONTACTS, limit, offset],
        queryFn: async (): Promise<ContactsResponse> => {
            const queryParams = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
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
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    return {
        contacts: data?.contacts || [],
        total: data?.total || 0,
        hasMore: data?.hasMore || false,
        isLoading,
        error,
        refetch,
    }
}
