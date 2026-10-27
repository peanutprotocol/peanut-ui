import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { unfinishedSignupRoute } from '@/features/setup/unfinished-signup'
import { isDemoMode } from '@/utils/demo'
import { useHydrationSnapshot } from '@/utils/native-platform'

/**
 * hook to check if logged-in user needs to complete account setup
 * returns whether user should be redirected and handles the redirect
 * should be used in layouts or pages that require a complete account
 */
export const useAccountSetupRedirect = () => {
    const demoMode = useHydrationSnapshot(isDemoMode, () => false)
    const { user, isFetchingUser } = useAuth()
    const router = useRouter()
    const pathName = usePathname()

    // synchronously check if user needs redirect (runs during render, not after)
    const target = useMemo(() => {
        if (!user || isFetchingUser || pathName === '/setup/finish') return null
        // Demo mode: synthetic user is complete; never bounce to setup.
        if (demoMode) return null
        return unfinishedSignupRoute(user)
    }, [user, isFetchingUser, pathName, demoMode])

    // perform redirect in effect
    useEffect(() => {
        if (target) {
            console.log(
                `[useAccountSetupRedirect] User logged in without peanut wallet account, redirecting to ${target}`
            )
            router.push(target)
            // Hard navigation fallback in case soft navigation silently fails.
            // Without this, needsRedirect stays true and the loading gate in
            // layout.tsx blocks rendering indefinitely.
            const fallback = setTimeout(() => {
                window.location.replace(target)
            }, 3000)
            return () => clearTimeout(fallback)
        }
        return undefined
    }, [target, router])

    return { needsRedirect: target !== null, isCheckingAccount: isFetchingUser }
}
