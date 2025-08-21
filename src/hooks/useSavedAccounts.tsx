import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'

/**
 * Used to get the user's saved accounts, for now limited to bank accounts with (IBAN, US, and CLABE)
 * NOTE: This hook can be extended to support more account types in the future based on requirements
 * @returns {array} An array of the user's saved bank accounts
 */
export default function useSavedAccounts() {
    const { user } = useAuth()

    // filter out accounts that are not IBAN, US, or CLABE
    const savedAccounts = useMemo(() => {
        return (
            user?.accounts.filter(
                (acc) => acc.type === AccountType.IBAN || acc.type === AccountType.US || acc.type === AccountType.CLABE
            ) ?? []
        )
    }, [user])

    return savedAccounts
}
