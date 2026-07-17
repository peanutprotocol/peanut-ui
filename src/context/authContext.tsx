'use client'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import { useUserAutoRefresh } from '@/hooks/useUserAutoRefresh'
import type { IUserProfile } from '@/interfaces/interfaces'
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
import { apiFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'
import { clearAuthToken } from '@/utils/auth-token'
import { resetCrispProxySessions } from '@/utils/crisp'
import { disableDemoMode } from '@/utils/demo'
import posthog from 'posthog-js'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { captureException, setUser as setSentryUser } from '@sentry/nextjs'
// import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'
import { USER_DATA_CACHE_PATTERNS } from '@/constants/cache.consts'

interface AuthContextType {
    user: IUserProfile | null
    userId: string | undefined
    username: string | undefined
    fetchUser: () => Promise<IUserProfile | null>
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
    const _router = useRouter()
    const dispatch = useAppDispatch()
    const toast = useToast()
    const queryClient = useQueryClient()
    const WEB_AUTHN_COOKIE_KEY = 'web-authn-key'

    const { data: user, isLoading: isFetchingUser, refetch: fetchUser, error: userFetchError } = useUserQuery()

    // Singleton auto-refresh poller — keeps the user query fresh while any
    // rail is provisioning OR a recent submission window is open. Mounted
    // here (rather than in useCapabilities) so N consumers share ONE interval
    // + one in-flight guard. See useUserAutoRefresh for the predicate.
    useUserAutoRefresh({ user, fetchUser })

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
            // and enrich the person profile for segmentation. Property names mirror the
            // server-side identify in peanut-api-ts src/log/identifyUser.ts — keep in sync.
            // `name` duplicates username because PostHog's Persons-page search is
            // hardcoded to email/name/distinct_id — username alone is not searchable.
            posthog.identify(user.user.userId, {
                username: user.user.username,
                name: user.user.username,
                userId: user.user.userId,
                totalPoints: user.totalPoints,
                // Badge codes (human-readable identifier), never the uuid.
                badges: user.user.badges?.map((badge) => badge.code) ?? [],
                kycStatus: user.identityVerification?.status ?? 'not_started',
            })
            // Sentry: every error captured from here on inherits user context
            // as searchable Sentry tags. Closes the historical gap where FE
            // errors were anonymous and had to be cross-referenced via the
            // posthog $sentry_url field to figure out which user hit them.
            setSentryUser({
                id: user.user.userId,
                username: user.user.username ?? undefined,
                email: user.user.email ?? undefined,
            })
        } else {
            // Logout / unauthenticated: clear Sentry user so subsequent
            // anonymous-session errors don't get misattributed.
            setSentryUser(null)
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

        const response = await apiFetch('/add-account', {
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

        /*
         * Cancel queries BEFORE wiping the token: an in-flight /users/me can carry a
         * sliding-refresh token and would re-persist it into native Preferences right
         * after the clear, so logout never sticks (Android splash-loop, kuxhagra).
         */
        try {
            await queryClient.cancelQueries()
            queryClient.clear()
        } catch (e) {
            console.warn('failed to clear queries on logout:', e)
        }

        // clear auth tokens (localStorage in capacitor, cookie on web)
        removeFromCookie(WEB_AUTHN_COOKIE_KEY)
        await clearAuthToken()

        // clear redirect url
        clearRedirectUrl()

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

        // clear demo mode flag
        disableDemoMode()

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
                /*
                 * Revoke server-side FIRST (needs the still-valid JWT): POST
                 * /users/logout bumps the account's tokenVersion so every
                 * outstanding JWT — this device and any other — stops
                 * verifying. Best-effort: a dead backend must never trap the
                 * user in a session, so failures fall through to local logout.
                 */
                if (!options?.skipBackendCall) {
                    try {
                        await apiFetch('/users/logout', { method: 'POST' })
                    } catch (e) {
                        console.warn('server-side session revocation failed, continuing local logout:', e)
                    }
                }

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
                toast.error('Error logging out')
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
