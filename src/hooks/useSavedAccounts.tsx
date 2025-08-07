import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'

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
