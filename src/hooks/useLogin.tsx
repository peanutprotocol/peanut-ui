import { useAuth } from '@/context/authContext'
import { useZeroDev } from './useZeroDev'
import { useEffect } from 'react'
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

    // Wait for user to be fetched, then redirect
    useEffect(() => {
        if (user) {
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
        }
    }, [user, router, searchParams])

    const handleLoginClick = async () => {
        await handleLogin()
    }

    return { handleLoginClick, isLoggingIn }
}
