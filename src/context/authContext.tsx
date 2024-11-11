'use client'
import { createContext, useContext, ReactNode, useRef } from 'react'
import * as interfaces from '@/interfaces'
import { useToast, ToastId } from '@chakra-ui/react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useQuery } from '@tanstack/react-query'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    username: string | undefined
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    updateUserName: (username: string) => Promise<void>
    submitProfilePhoto: (file: File) => Promise<void>
    updateBridgeCustomerId: (bridgeCustomerId: string) => Promise<void>
    addBYOW: () => Promise<void>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
    }) => Promise<void>
    isFetchingUser: boolean
    logoutUser: () => Promise<void>
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { open: web3modalOpen } = useWeb3Modal()
    const {
        data: user,
        isLoading: isFetchingUser,
        refetch: fetchUser,
    } = useQuery<interfaces.IUserProfile | null>({
        queryKey: ['user'],
        initialData: null,
        queryFn: async () => {
            const userResponse = await fetch('/api/peanut/user/get-user-from-cookie')
            if (userResponse.ok) {
                const userData: interfaces.IUserProfile | null = await userResponse.json()

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
            const response = await fetch('/api/peanut/user/update-user', {
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
    const updateBridgeCustomerId = async (bridgeCustomerId: string) => {
        if (!user) return

        try {
            const response = await fetch('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bridge_customer_id: bridgeCustomerId,
                    userId: user.user.userId,
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

            const response = await fetch('/api/peanut/user/submit-profile-photo', {
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
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
        bridgeAccountId?: string
    }) => {
        try {
            const response = await fetch('/api/peanut/user/add-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    accountIdentifier,
                    bridgeAccountId,
                    accountType,
                }),
            })

            if (response.ok) {
                fetchUser()
            } else {
                console.error('Failed to update user')
            }
        } catch (error) {
            console.error('Error updating user', error)
        }
    }

    const logoutUser = async () => {
        try {
            const response = await fetch('/api/peanut/user/logout-user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (response.ok) {
                fetchUser()
            } else {
                console.error('Failed to log out user')
            }
        } catch (error) {
            console.error('Error updating user', error)
        }
    }

    console.log({ user })

    return (
        <AuthContext.Provider
            value={{
                user,
                username: user?.user?.username ?? undefined,
                updateBridgeCustomerId,
                fetchUser: legacy_fetchUser,
                updateUserName,
                submitProfilePhoto,
                addBYOW,
                addAccount,
                isFetchingUser,
                logoutUser,
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
