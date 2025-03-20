'use client'
import { usePWAStatus } from '@/hooks/usePWAStatus'
import * as interfaces from '@/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { type GetUserLinksResponse, fetchWithSentry } from '@/utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { ToastId, useToast } from '@chakra-ui/react' // TODO: use normmal toasts we use throughout the app, not chakra toasts!
import { useAppKit } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, ReactNode, useContext, useRef, useState } from 'react'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    userId: string | undefined
    username: string | undefined
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    updateUserName: (username: string) => Promise<void>
    submitProfilePhoto: (file: File) => Promise<void>
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
    const isPwa = usePWAStatus()
    const dispatch = useAppDispatch()
    const {
        data: user,
        isFetching: isFetchingUser,
        refetch: fetchUser,
    } = useQuery<interfaces.IUserProfile | null>({
        queryKey: ['user'],
        initialData: null,
        queryFn: async () => {
            const userResponse = await fetchWithSentry('/api/peanut/user/get-user-from-cookie')
            if (userResponse.ok) {
                const userData: interfaces.IUserProfile | null = await userResponse.json()
                if (userData) {
                    // no await, log metric async
                    hitUserMetric(userData.user.userId, 'login', { isPwa: isPwa })
                }

                return userData
            } else {
                console.warn('Failed to fetch user. Probably not logged in.')
                return null
            }
        },
    })

    const legacy_fetchUser = async () => {
        const { data: fetchedUser } = await fetchUser()
        return fetchedUser ?? null
    }

    const toast = useToast({
        position: 'bottom-right',
        duration: 5000,
        isClosable: true,
        icon: '🥜',
    })
    const toastIdRef = useRef<ToastId | undefined>(undefined)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const updateUserName = async (username: string) => {
        if (!user) return

        try {
            if (toastIdRef.current) {
                toast.close(toastIdRef.current)
            }
            toastIdRef.current = toast({
                status: 'loading',
                title: 'Updating username...',
            }) as ToastId
            const response = await fetchWithSentry('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    userId: user.user.userId,
                }),
            })

            if (response.status === 409) {
                const data = await response.json()
                toast.close(toastIdRef.current)
                toastIdRef.current = toast({
                    status: 'error',
                    title: data,
                }) as ToastId

                return
            }

            if (!response.ok) {
                throw new Error(response.statusText)
            }
            toast.close(toastIdRef.current)
            toastIdRef.current = toast({
                status: 'success',
                title: 'Username updated successfully',
            }) as ToastId
        } catch (error) {
            console.error('Error updating user', error)
            toast.close(toastIdRef.current ?? '')
            toastIdRef.current = toast({
                status: 'error',
                title: 'Failed to update username',
                description: 'Please try again later',
            }) as ToastId
        } finally {
            fetchUser()
        }
    }
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

    const submitProfilePhoto = async (file: File) => {
        if (!user) return

        try {
            if (toastIdRef.current) {
                toast.close(toastIdRef.current)
            }
            toastIdRef.current = toast({
                status: 'loading',
                title: 'Updating profile photo...',
            }) as ToastId
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetchWithSentry('/api/peanut/user/submit-profile-photo', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer your-auth-token`,
                    'api-key': 'your-api-key',
                },
                body: formData,
            })

            if (response.ok) {
                fetchUser()
            } else {
                throw new Error(response.statusText)
            }
            toast.close(toastIdRef.current)
            toastIdRef.current = toast({
                status: 'success',
                title: 'Profile photo updated successfully',
            }) as ToastId
        } catch (error) {
            console.error('Error submitting profile photo', error)
            toast.close(toastIdRef.current ?? '')
            toastIdRef.current = toast({
                status: 'error',
                title: 'Failed to update profile photo',
                description: 'Please try again later',
            }) as ToastId
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

                // clear JWT cookie by setting it to expire
                document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'

                await fetchUser()
                dispatch(setupActions.resetSetup())
                router.replace('/setup')

                toast({
                    status: 'success',
                    title: 'Logged out successfully',
                    duration: 3000,
                })
            } else {
                console.error('Failed to log out user')
                toast({
                    status: 'error',
                    title: 'Failed to log out',
                    description: 'Please try again',
                    duration: 5000,
                })
            }
        } catch (error) {
            console.error('Error logging out user', error)
            toast({
                status: 'error',
                title: 'Error logging out',
                description: 'Please try again',
                duration: 5000,
            })
        } finally {
            setIsLoggingOut(false)
        }
    }

    console.log({ user })

    return (
        <AuthContext.Provider
            value={{
                user,
                userId: user?.user?.userId,
                username: user?.user?.username ?? undefined,
                updateBridgeCustomerData,
                fetchUser: legacy_fetchUser,
                updateUserName,
                submitProfilePhoto,
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
