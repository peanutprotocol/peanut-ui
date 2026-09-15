import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@/context/authContext'
import { WalletProviderType } from '@/interfaces/wallet.interfaces'
import { clearAuthState } from '@/utils/auth.utils'
import { POST_SIGNUP_ACTIONS } from '@/components/Global/PostSignupActionManager/post-signup-action.consts'
import { consumePostAuthRedirect } from '@/services/post-auth-redirect'
import { AccountSetupError } from '@/services/account-setup'

/**
 * shared hook for finalizing account setup after test transaction succeeds
 * handles adding account to db and navigation logic
 */
export const useAccountSetup = () => {
    const { user } = useAuth()
    const { addAccount } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    /**
     * @param options.isNewAccount - This account was just created here, so a
     * destination that only marks where an earlier session ended is not its
     * inheritance (a fresh signup landed on the previous account's /profile).
     * A deep link the person actually asked for still wins, stored or passed
     * as `redirect_uri`.
     */
    const handleRedirect = (options?: { isNewAccount?: boolean }): boolean => {
        const redirect = consumePostAuthRedirect(searchParams.get('redirect_uri'), {
            deferStoredRedirect: (destination) =>
                POST_SIGNUP_ACTIONS.some((action) => action.pathPattern.test(destination)),
            rejectSessionEndOrigin: options?.isNewAccount,
        })

        console.log('[useAccountSetup] Resolved post-auth redirect:', redirect)
        router.replace(redirect.destination)
        return redirect.source === 'explicit'
    }

    /**
     * finalize account setup by adding account to db. Navigation is the
     * caller's: signup pauses on the account-ready screen and redirects from
     * its CTA, so redirecting here raced it off the screen.
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

            const outcome = await addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user.user.userId as string,
            })
            Sentry.addBreadcrumb({
                category: 'account-setup',
                level: 'info',
                message: 'Account setup completed',
                data: outcome,
            })

            return true
        } catch (e) {
            const setupError = e instanceof AccountSetupError ? e : null
            Sentry.addBreadcrumb({
                category: 'account-setup',
                level: 'warning',
                message: 'Account setup did not complete',
                data: {
                    outcome: setupError?.kind ?? 'unknown',
                    requestAttempts: setupError?.requestAttempts,
                    status: setupError?.status,
                },
            })
            // fetchWithSentry is the error event of record. Keep this wrapper
            // informational so one failed request does not create extra issues.
            console.info('[useAccountSetup] Account setup did not complete', {
                outcome: setupError?.kind ?? 'unknown',
                requestAttempts: setupError?.requestAttempts,
                status: setupError?.status,
            })
            setError('Error adding account. Please try refreshing the page.')

            // Ambiguous transport/server failures keep the valid signup session.
            // Only the authenticated endpoint's explicit credential rejection
            // proves this session should be removed.
            if (setupError?.kind === 'invalid_credentials') {
                await clearAuthState(user.user.userId)
            }
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
        handleRedirect,
    }
}
