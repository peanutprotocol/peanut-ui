import { useAuth } from '@/context/authContext'
import { useZeroDev } from './useZeroDev'
import { useEffect } from 'react'
import { getFromLocalStorage, sanitizeRedirectURL } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'

export const useLogin = () => {
    const { user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const searchParams = useSearchParams()
    const router = useRouter()

    // Wait for user to be fetched, then redirect
    useEffect(() => {
        if (user) {
            const localStorageRedirect = getFromLocalStorage('redirect')
            const redirect_uri = searchParams.get('redirect_uri')
            if (redirect_uri) {
                let decodedRedirect = redirect_uri
                try {
                    decodedRedirect = decodeURIComponent(redirect_uri)
                } catch {}
                const sanitizedRedirectUrl = sanitizeRedirectURL(decodedRedirect)
                router.push(sanitizedRedirectUrl)
            } else if (localStorageRedirect) {
                localStorage.removeItem('redirect')
                const sanitizedLocalRedirect = sanitizeRedirectURL(String(localStorageRedirect))
                router.push(sanitizedLocalRedirect)
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
