import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@/context/authContext'
import { WalletProviderType } from '@/interfaces'
import { getRedirectUrl, getValidRedirectUrl, clearRedirectUrl, clearAuthState } from '@/utils'
import { POST_SIGNUP_ACTIONS } from '@/components/Global/PostSignupActionManager/post-signup-action.consts'
import { useSetupStore } from '@/redux/hooks'

/**
 * shared hook for finalizing account setup after test transaction succeeds
 * handles adding account to db and navigation logic
 */
export const useAccountSetup = () => {
    const { user } = useAuth()
    const { addAccount } = useAuth()
    const { telegramHandle } = useSetupStore()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    /**
     * finalize account setup by adding account to db and navigating
     */
    const finalizeAccountSetup = async (address: string) => {
        console.log('[useAccountSetup] Starting account finalization', { address, userId: user?.user.userId })

        if (!user) {
            console.error('[useAccountSetup] No user found')
            setError('User not found. Please refresh the page.')
            return false
        }

        setIsProcessing(true)
        setError(null)

        try {
            console.log('[useAccountSetup] Adding account to database')
            await addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user.user.userId as string,
                telegramHandle: telegramHandle.length > 0 ? telegramHandle : undefined,
            })
            console.log('[useAccountSetup] Account added successfully')

            const redirect_uri = searchParams.get('redirect_uri')
            if (redirect_uri) {
                const validRedirectUrl = getValidRedirectUrl(redirect_uri, '/home')
                console.log('[useAccountSetup] Redirecting to redirect_uri:', validRedirectUrl)
                router.push(validRedirectUrl)
                return true
            }

            const localStorageRedirect = getRedirectUrl()
            if (localStorageRedirect) {
                const matchedAction = POST_SIGNUP_ACTIONS.find((action) =>
                    action.pathPattern.test(localStorageRedirect)
                )
                if (matchedAction) {
                    console.log('[useAccountSetup] Matched post-signup action, redirecting to /home')
                    router.push('/home')
                } else {
                    clearRedirectUrl()
                    const validRedirectUrl = getValidRedirectUrl(localStorageRedirect, '/home')
                    console.log('[useAccountSetup] Redirecting to localStorage redirect:', validRedirectUrl)
                    router.push(validRedirectUrl)
                }
            } else {
                console.log('[useAccountSetup] No redirect found, going to /home')
                router.push('/home')
            }

            return true
        } catch (e) {
            Sentry.captureException(e)
            console.error('[useAccountSetup] Error adding account:', e)
            setError('Error adding account. Please try refreshing the page.')

            // clear auth state if account creation fails
            clearAuthState(user?.user.userId)
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    return {
        finalizeAccountSetup,
        isProcessing,
        error,
        setError,
    }
}
