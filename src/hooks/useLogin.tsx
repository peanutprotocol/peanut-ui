import { useAuth } from '@/context/authContext'
import { useZeroDev } from './useZeroDev'
import { useEffect, useState } from 'react'
import { getRedirectUrl, getValidRedirectUrl, clearRedirectUrl } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Hook for handling user login and post-login redirects.
 *
 * Manages the login flow by coordinating authentication state and routing.
 * After successful login, redirects users to:
 * 1. `redirect_uri` query parameter (if present and safe)
 * 2. Saved redirect URL from localStorage (if present and safe)
 * 3. '/home' as fallback
 *
 * Note: The mobile-ui layout handles redirecting users without PEANUT_WALLET accounts to /setup/finish
 *
 * All redirects are sanitized to prevent external URL redirection attacks.
 *
 * @returns {Object} Login handlers and state
 * @returns {Function} handleLoginClick - Async function to initiate login
 * @returns {boolean} isLoggingIn - Loading state during login process
 */

export const useLogin = () => {
    const { user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [isloginClicked, setIsloginClicked] = useState(false)

    // wait for user to be fetched, then redirect
    useEffect(() => {
        // run only if login button is clicked to prevent un-intentional redirects
        if (isloginClicked && user) {
            // redirect based on query params or saved redirect url
            const localStorageRedirect = getRedirectUrl()
            const redirect_uri = searchParams.get('redirect_uri')
            if (redirect_uri) {
                const validRedirectUrl = getValidRedirectUrl(redirect_uri, '/home')
                router.push(validRedirectUrl)
            } else if (localStorageRedirect) {
                clearRedirectUrl()
                const validRedirectUrl = getValidRedirectUrl(String(localStorageRedirect), '/home')
                router.push(validRedirectUrl)
            } else {
                router.push('/home')
            }
            setIsloginClicked(false)
        }
    }, [user, router, searchParams, isloginClicked])

    const handleLoginClick = async () => {
        setIsloginClicked(true)
        await handleLogin()
    }

    return { handleLoginClick, isLoggingIn }
}
