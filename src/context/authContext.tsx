'use client'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import {
    fetchWithSentry,
    removeFromCookie,
    syncLocalStorageToCookie,
    clearRedirectUrl,
    updateUserPreferences,
} from '@/utils'
import { resetCrispProxySessions } from '@/utils/crisp'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, type ReactNode, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { captureException } from '@sentry/nextjs'

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
            if (response.status === 409) {
                throw new Error('Account already exists')
            }
            console.error('Unexpected error adding account', response)
            throw new Error('Unexpected error adding account')
        }

        fetchUser()
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
                updateUserPreferences(user?.user.userId, { webAuthnKey: undefined })
                removeFromCookie(WEB_AUTHN_COOKIE_KEY)
                clearRedirectUrl()
                queryClient.invalidateQueries()

                // clear JWT cookie by setting it to expire
                document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'

                // clear the iOS PWA prompt session flag
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('hasSeenIOSPWAPromptThisSession')
                }

                // Reset Crisp session to prevent session merging with next user
                // This resets both main window Crisp instance and any proxy page instances
                if (typeof window !== 'undefined') {
                    resetCrispProxySessions()
                }

                await fetchUser()
                dispatch(setupActions.resetSetup())
                router.replace('/setup')

                toast.success('Logged out successfully')
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
