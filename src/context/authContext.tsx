'use client'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useUserQuery } from '@/hooks/query/user'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { type GetUserLinksResponse, fetchWithSentry } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, ReactNode, useContext, useState } from 'react'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    userId: string | undefined
    username: string | undefined
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    updateBridgeCustomerData: (customer: GetUserLinksResponse) => Promise<void>
    addBYOW: () => Promise<void>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
        connector,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        connector?: {
            iconUrl: string
            name: string
        }
    }) => Promise<void>
    isFetchingUser: boolean
    logoutUser: () => Promise<void>
    isLoggingOut: boolean
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter()
    const { open: web3modalOpen } = useAppKit()
    const dispatch = useAppDispatch()
    const { user: authUser } = useUserStore()
    const toast = useToast()
    const queryClient = useQueryClient()

    const { data: user, isFetching: isFetchingUser, refetch: fetchUser } = useUserQuery(!authUser?.user.userId)

    const legacy_fetchUser = async () => {
        const { data: fetchedUser } = await fetchUser()
        return fetchedUser ?? null
    }

    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const updateBridgeCustomerData = async (customer: GetUserLinksResponse) => {
        if (!user) return

        try {
            const response = await fetchWithSentry('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bridge_customer_id: customer.id,
                    userId: user.user.userId,
                    kycStatus: customer.kyc_status,
                }),
            })

            if (response.ok) {
                const updatedUserData: any = await response.json()
                if (updatedUserData.success) {
                    fetchUser()
                }
            } else {
                console.error('Failed to update user')
            }
        } catch (error) {
            console.error('Error updating user', error)
        }
    }

    const addBYOW = async () => {
        // we open the web3modal, so the user can disconnect the previous wallet,
        // connect a new wallet and allow the useEffect(..., [wagmiAddress]) in walletContext take over
        web3modalOpen()
    }

    const addAccount = async ({
        accountIdentifier,
        accountType,
        userId,
        bridgeAccountId,
        connector,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        bridgeAccountId?: string
        connector?: {
            iconUrl: string
            name: string
        }
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

    const logoutUser = async () => {
        const LOCAL_STORAGE_WEB_AUTHN_KEY = 'web-authn-key'

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
                localStorage.removeItem(LOCAL_STORAGE_WEB_AUTHN_KEY)
                queryClient.invalidateQueries()

                // clear JWT cookie by setting it to expire
                document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'

                // clear the iOS PWA prompt session flag
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('hasSeenIOSPWAPromptThisSession')
                }

                await fetchUser()
                dispatch(setupActions.resetSetup())
                router.replace('/setup')

                toast.success('Logged out successfully')
            } else {
                console.error('Failed to log out user')
                toast.error('Failed to log out')
            }
        } catch (error) {
            console.error('Error logging out user', error)
            toast.error('Error logging out')
        } finally {
            setIsLoggingOut(false)
        }
    }

    console.log({ user })

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                updateBridgeCustomerData,
                fetchUser: legacy_fetchUser,
                addBYOW,
                addAccount,
                isFetchingUser,
                logoutUser,
                isLoggingOut,
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
