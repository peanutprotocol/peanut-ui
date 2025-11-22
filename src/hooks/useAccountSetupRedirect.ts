import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'

/**
 * hook to check if logged-in user needs to complete account setup
 * returns whether user should be redirected and handles the redirect
 * should be used in layouts or pages that require a complete account
 */
export const useAccountSetupRedirect = () => {
    const { user, isFetchingUser } = useAuth()
    const router = useRouter()
    const pathName = usePathname()

    // synchronously check if user needs redirect (runs during render, not after)
    const needsRedirect = useMemo(() => {
        if (!user || isFetchingUser || pathName === '/setup/finish') return false

        const hasPeanutWalletAccount = user.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)
        return !hasPeanutWalletAccount
    }, [user, isFetchingUser, pathName])

    // perform redirect in effect
    useEffect(() => {
        if (needsRedirect) {
            console.log(
                '[useAccountSetupRedirect] User logged in without peanut wallet account, redirecting to /setup/finish'
            )
            router.push('/setup/finish')
        }
    }, [needsRedirect, router])

    return { needsRedirect, isCheckingAccount: isFetchingUser }
}
