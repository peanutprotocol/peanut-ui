'use client'

import { useQuery } from '@tanstack/react-query'
import { getContacts } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { CONTACTS } from '@/constants/query.consts'

/** Addressed requests require a canonical money contact, in either direction. */
export function useRequestContact(username: string, enabled = true) {
    const { user } = useAuth()
    const normalizedUsername = username?.toLowerCase()
    return useQuery({
        queryKey: [CONTACTS, 'request-recipient', user?.user.userId, normalizedUsername],
        enabled: enabled && !!user?.user.userId && !!normalizedUsername,
        queryFn: async () => {
            let offset = 0
            const limit = 50
            while (true) {
                const { data, error } = await getContacts({ limit, offset, search: normalizedUsername })
                if (error || !data) throw new Error(error || 'Failed to fetch contacts')
                const contact = data.contacts.find((contact) => contact.username.toLowerCase() === normalizedUsername)
                if (contact) {
                    return contact.relationshipTypes.some((type) => type === 'sent_money' || type === 'received_money')
                        ? contact
                        : null
                }
                if (!data.hasMore) return null
                offset += limit
            }
        },
    })
}
