'use client'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import * as interfaces from '@/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { zerodevActions } from '@/redux/slices/zerodev-slice'
import {
    fetchWithSentry,
    removeFromCookie,
    syncLocalStorageToCookie,
    clearRedirectUrl,
    updateUserPreferences,
} from '@/utils'
import { resetCrispProxySessions } from '@/utils/crisp'
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
    logoutUser: () => Promise<void>
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

    const { data: user, isLoading: isFetchingUser, refetch: fetchUser } = useUserQuery()

    // Pre-compute a Set of invited usernames for O(1) lookups
    const invitedUsernamesSet = useMemo(() => {
        if (!user?.invitesSent) return new Set<string>()
        return new Set(user.invitesSent.map((invite) => invite.inviteeUsername))
    }, [user?.invitesSent])

    useEffect(() => {
        if (user) {
            syncLocalStorageToCookie(WEB_AUTHN_COOKIE_KEY)
        }
    }, [user])

    const legacy_fetchUser = async () => {
        const { data: fetchedUser } = await fetchUser()
        return fetchedUser ?? null
    }

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

        const response = await fetchWithSentry('/api/peanut/user/add-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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

    const logoutUser = useCallback(async () => {
        if (isLoggingOut) return

        setIsLoggingOut(true)
        try {
            const response = await fetchWithSentry('/api/peanut/user/logout-user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (response.ok) {
                // clear user preferences (webauthn key in localStorage)
                updateUserPreferences(user?.user.userId, { webAuthnKey: undefined })

                // clear cookies
                removeFromCookie(WEB_AUTHN_COOKIE_KEY)
                document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'

                // clear redirect url
                clearRedirectUrl()

                // invalidate all queries
                queryClient.invalidateQueries()

                // reset redux state (setup and zerodev)
                dispatch(setupActions.resetSetup())
                dispatch(zerodevActions.resetZeroDevState())
                console.log('[Logout] Cleared redux state (setup and zerodev)')

                // Clear service worker caches to prevent user data leakage
                // When User A logs out and User B logs in on the same device, cached API responses
                // could expose User A's data (profile, transactions, KYC) to User B
                // Only clears user-specific caches; preserves prices and external resources
                if ('caches' in window) {
                    try {
                        const cacheNames = await caches.keys()
                        await Promise.all(
                            cacheNames
                                .filter((name) => USER_DATA_CACHE_PATTERNS.some((pattern) => name.includes(pattern)))
                                .map((name) => {
                                    console.log('Logout: Clearing cache:', name)
                                    return caches.delete(name)
                                })
                        )
                    } catch (error) {
                        console.error('Failed to clear caches on logout:', error)
                        // Non-fatal: logout continues even if cache clearing fails
                    }
                }

                // clear the iOS PWA prompt session flag
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('hasSeenIOSPWAPromptThisSession')
                }

                // Reset Crisp session to prevent session merging with next user
                // This resets both main window Crisp instance and any proxy page instances
                if (typeof window !== 'undefined') {
                    resetCrispProxySessions()
                }

                // fetch user (should return null after logout)
                await fetchUser()

                // force full page refresh to /setup to clear all state
                // this ensures no stale redux/react state persists after logout
                window.location.href = '/setup'
            }
        } catch (error) {
            captureException(error)
            console.error('Error logging out user', error)
            toast.error('Error logging out')
        } finally {
            setIsLoggingOut(false)
        }
    }, [fetchUser, isLoggingOut, user])

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                fetchUser: legacy_fetchUser,
                addAccount,
                isFetchingUser,
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
