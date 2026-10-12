'use client'
import { useCallback } from 'react'
import { useAuth } from '@/context/authContext'
import { accountsApi } from '@/services/accounts'

/**
 * Name a saved bank account. The user object is the list every picker reads,
 * so the refetch is what makes the new name appear — there is no separate
 * accounts query to invalidate.
 */
export function useRenameAccount(): (id: string, label: string) => Promise<void> {
    const { fetchUser } = useAuth()
    return useCallback(
        async (id: string, label: string) => {
            await accountsApi.rename(id, label)
            await fetchUser()
        },
        [fetchUser]
    )
}
