'use client'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import * as interfaces from '@/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { userActions } from '@/redux/slices/user-slice'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import {
    removeFromCookie,
    syncLocalStorageToCookie,
    clearRedirectUrl,
    updateUserPreferences,
} from '@/utils/general.utils'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { apiFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { clearAuthToken } from '@/utils/auth-token'
import { resetCrispProxySessions } from '@/utils/crisp'
import posthog from 'posthog-js'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { captureException } from '@sentry/nextjs'
// import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'
import { USER_DATA_CACHE_PATTERNS } from '@/constants/cache.consts'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    userId: string | undefined
    username: string | undefined
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
        connector,
        telegramHandle,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        telegramHandle?: string
        connector?: {
            iconUrl: string
            name: string
        }
    }) => Promise<void>
    isFetchingUser: boolean
    userFetchError: Error | null
    logoutUser: (options?: { skipBackendCall?: boolean }) => Promise<void>
    isLoggingOut: boolean
    invitedUsernamesSet: Set<string>
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const toast = useToast()
    const queryClient = useQueryClient()
    const WEB_AUTHN_COOKIE_KEY = 'web-authn-key'

    const { data: user, isLoading: isFetchingUser, refetch: fetchUser, error: userFetchError } = useUserQuery()

    // Pre-compute a Set of invited usernames for O(1) lookups
    const invitedUsernamesSet = useMemo(() => {
        if (!user?.invitesSent) return new Set<string>()
        return new Set(user.invitesSent.map((invite) => invite.inviteeUsername))
    }, [user?.invitesSent])

    useEffect(() => {
        if (user) {
            syncLocalStorageToCookie(WEB_AUTHN_COOKIE_KEY)
            if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('set', { user_id: user.user.userId })
            }
            // PostHog: identify user (stitches anonymous pre-login events to this user)
            posthog.identify(user.user.userId, {
                username: user.user.username,
            })
        }
    }, [user])

    const legacy_fetchUser = useCallback(async () => {
        const { data: fetchedUser } = await fetchUser()
        return fetchedUser ?? null
    }, [fetchUser])

    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const addAccount = async ({
        accountIdentifier,
        accountType,
        userId,
        bridgeAccountId,
        connector,
        telegramHandle,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        bridgeAccountId?: string
        connector?: {
            iconUrl: string
            name: string
        }
        telegramHandle?: string
    }) => {
        console.log('[addAccount] Starting account addition', { userId, accountType })

        const response = await apiFetch('/add-account', '/api/peanut/user/add-account', {
            method: 'POST',
            body: JSON.stringify({
                userId,
                accountIdentifier,
                bridgeAccountId,
                accountType,
                connector,
                telegramHandle,
            }),
        })

        if (!response.ok) {
            console.error('[addAccount] Failed to add account', {
                status: response.status,
                statusText: response.statusText,
            })

            if (response.status === 409) {
                throw new Error('Account already exists')
            }
            console.error('Unexpected error adding account', response)
            throw new Error('Unexpected error adding account')
        }

        console.log('[addAccount] Account added successfully, fetching user data')

        // CRITICAL FIX: Wait for user data to be fetched before continuing
        // This ensures JWT cookie is set and user data is available before redirect
        const { data: updatedUser } = await fetchUser()

        if (!updatedUser) {
            console.error('[addAccount] Failed to fetch user after account creation')
            throw new Error('Failed to load user data after account creation')
        }

        console.log('[addAccount] User data fetched successfully', {
            userId: updatedUser.user.userId,
            accountCount: updatedUser.accounts.length,
        })
    }

    /**
     * Clears all client-side auth state (cookies, localStorage, redux, caches)
     * Used by both normal logout and force logout (when backend is down)
     */
    const clearLocalAuthState = useCallback(async () => {
        // clear user preferences (webauthn key in localStorage)
        updateUserPreferences(user?.user.userId, { webAuthnKey: undefined })

        // clear auth tokens (localStorage in capacitor, cookie on web)
        removeFromCookie(WEB_AUTHN_COOKIE_KEY)
        clearAuthToken()

        // clear redirect url
        clearRedirectUrl()

        // cancel + remove all queries to prevent refetches with cleared jwt
        try {
            queryClient.cancelQueries()
            queryClient.clear()
        } catch (e) {
            console.warn('failed to clear queries on logout:', e)
        }

        // reset redux state (user, setup, zerodev)
        dispatch(userActions.setUser(null))
        dispatch(setupActions.resetSetup())
        dispatch(zerodevActions.resetZeroDevState())

        // clear service worker caches (non-fatal if it fails)
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys()
                await Promise.all(
                    cacheNames
                        .filter((name) => USER_DATA_CACHE_PATTERNS.some((pattern) => name.includes(pattern)))
                        .map((name) => caches.delete(name))
                )
            } catch (e) {
                console.warn('failed to clear caches on logout:', e)
            }
        }

        // clear session flags
        try {
            sessionStorage.removeItem('hasSeenIOSPWAPromptThisSession')
        } catch {}

        // reset third-party sessions (non-fatal)
        try {
            resetCrispProxySessions()
        } catch (e) {
            console.warn('crisp reset failed:', e)
        }
        try {
            posthog.reset()
        } catch (e) {
            console.warn('posthog reset failed:', e)
        }
    }, [dispatch, queryClient, user?.user.userId])

    /**
     * Logs out the user
     * @param options.skipBackendCall - If true, skips the backend logout call (useful when backend is down)
     */
    const logoutUser = useCallback(
        async (options?: { skipBackendCall?: boolean }) => {
            if (isLoggingOut) return

            setIsLoggingOut(true)
            try {
                // Call backend logout unless skipped (e.g., when backend is down)
                // in capacitor, there's no backend logout route — just clear client-side state.
                // on web, the /api/ route clears the server-side cookie.
                if (!options?.skipBackendCall && !isCapacitor()) {
                    const response = await fetchWithSentry('/api/peanut/user/logout-user', {
                        method: 'GET',
                    })

                    if (!response.ok) {
                        throw new Error('Backend logout failed')
                    }
                }

                // Clear all client-side auth state
                await clearLocalAuthState()

                // fetch user (should return null after logout) - skip for capacitor
                // (jwt is already cleared, fetching would just 401)
                if (!options?.skipBackendCall && !isCapacitor()) {
                    await fetchUser()
                }

                // force full page refresh to /setup to clear all state
                window.location.href = '/setup'
            } catch (error) {
                captureException(error)
                console.error('Error logging out user', error)
                // TODO: remove debug info after native testing
                toast.error(`Error logging out: ${(error as Error).message}`)
            } finally {
                setIsLoggingOut(false)
            }
        },
        [clearLocalAuthState, fetchUser, isLoggingOut, toast]
    )

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                fetchUser: legacy_fetchUser,
                addAccount,
                isFetchingUser,
                userFetchError: userFetchError ?? null,
                logoutUser,
                isLoggingOut,
                invitedUsernamesSet,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
