import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from './useZeroDev'
import { captureMessage } from '@sentry/nextjs'
import { useEffect, useState } from 'react'
import { getRedirectUrl, getValidRedirectUrl, clearRedirectUrl } from '@/utils/general.utils'
import { useRouter, useSearchParams } from 'next/navigation'

// how long we wait for the user object after a successful passkey ceremony
const POST_LOGIN_USER_TIMEOUT_MS = 15_000

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
    const toast = useToast()
    const [isloginClicked, setIsloginClicked] = useState(false)
    const [loginResolved, setLoginResolved] = useState(false)

    // wait for user to be fetched, then redirect
    useEffect(() => {
        /*
         * Gate on loginResolved (ceremony finished), not just the click: a stale
         * user can re-appear mid-ceremony (refetchOnWindowFocus fires when the
         * OS passkey sheet blurs/refocuses the webview) and `isloginClicked &&
         * user` would then paint /home — balance and activity included — before
         * the passkey was ever verified.
         */
        if (isloginClicked && loginResolved && user) {
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
            setLoginResolved(false)
        }
    }, [user, router, searchParams, isloginClicked, loginResolved])

    // the ceremony succeeded but the user object never arrived (e.g. token not
    // stored / fetch failed) — without this the UI idles on the setup screen forever.
    useEffect(() => {
        if (!loginResolved || user) return
        const timer = setTimeout(() => {
            setIsloginClicked(false)
            setLoginResolved(false)
            toast.error('Login didn’t complete. Please try again.')
            captureMessage('login ceremony succeeded but user never loaded', {
                level: 'warning',
                tags: { error_type: 'login_stalled' },
            })
        }, POST_LOGIN_USER_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [loginResolved, user, toast])

    const handleLoginClick = async () => {
        setIsloginClicked(true)
        try {
            await handleLogin()
            setLoginResolved(true)
        } catch (e) {
            setIsloginClicked(false)
            throw e
        }
    }

    return { handleLoginClick, isLoggingIn }
}
