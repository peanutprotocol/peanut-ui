'use client'

import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'

/**
 * Used to get the user's saved bank accounts (IBAN, US/ACH, CLABE, GB sort-code,
 * and Manteca LATAM accounts — AR CBU/CVU, BR PIX — which the backend projects
 * under the single 'manteca' type).
 * NOTE: This hook can be extended to support more account types in the future based on requirements
 * @returns {array} An array of the user's saved bank accounts
 */
export default function useSavedAccounts() {
    const { user } = useAuth()

    // keep only saved bank accounts. Manteca (AR/BR) was previously omitted, so
    // Manteca users' saved bank accounts never appeared in the claim/send-link
    // bank flows — they had to re-enter their CBU/CVU/PIX every time.
    const savedAccounts = useMemo(() => {
        return (
            user?.accounts.filter(
                (acc) =>
                    acc.type === AccountType.IBAN ||
                    acc.type === AccountType.US ||
                    acc.type === AccountType.CLABE ||
                    acc.type === AccountType.GB ||
                    acc.type === AccountType.MANTECA
            ) ?? []
        )
    }, [user])

    return savedAccounts
}
