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
    bridgeKycStatus: string
    showFullName: boolean
    relationshipTypes: ('inviter' | 'invitee' | 'sent_money' | 'received_money')[]
    firstInteractionDate: string
    lastInteractionDate: string
    transactionCount: number
}

interface ContactsResponse {
    contacts: Contact[]
}

/**
 * hook to fetch all contacts for the current user
 * includes inviter, invitees, and all transaction counterparties
 */
export function useContacts() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: [CONTACTS],
        queryFn: async (): Promise<ContactsResponse> => {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/users/contacts`, {
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
        isLoading,
        error,
        refetch,
    }
}
