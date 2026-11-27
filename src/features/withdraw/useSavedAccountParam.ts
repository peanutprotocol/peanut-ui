'use client'

import { useMemo } from 'react'
import { useAuth } from '@/context/authContext'
import { type Account } from '@/interfaces/interfaces'
import { isUsableSavedAccount } from '@/utils/bridge-accounts.utils'

/**
 * The query parameter that names a saved account on /withdraw/manteca: its id,
 * never its CBU, alias or Pix key. A query value reaches PostHog's
 * `$current_url`, the browser history and the request logs, and an account
 * number is personal data. The id survives a refresh and means nothing outside
 * the user's own accounts.
 */
export const SAVED_ACCOUNT_PARAM = 'account'

/** The usable saved account the URL names, or null. */
export function useSavedAccountParam(searchParams: Pick<URLSearchParams, 'get'>): Account | null {
    const { user } = useAuth()
    const id = searchParams.get(SAVED_ACCOUNT_PARAM)
    return useMemo(() => {
        if (!id) return null
        const account = ((user?.accounts ?? []) as unknown as Account[]).find((acc) => acc.id === id)
        return account && isUsableSavedAccount(account) ? account : null
    }, [id, user])
}
