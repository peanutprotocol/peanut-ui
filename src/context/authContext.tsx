'use client'
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import { useToast, ToastId } from '@chakra-ui/react'
import { useAccount, useSignMessage } from 'wagmi'
import { useWallet } from './walletContext'
import { useZeroDev } from './walletContext/zeroDevContext.context'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    setUser: (user: interfaces.IUserProfile | null) => void
    isAuthed: boolean
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    updateUserName: (username: string) => Promise<void>
    submitProfilePhoto: (file: File) => Promise<void>
    updateBridgeCustomerId: (bridgeCustomerId: string) => Promise<void>
    registerUserWithPasskey: (username: string) => Promise<void>
    loginUserWithPasskey: (username: string) => Promise<void>
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
    // TODO: address here should be fetched from the walletContext
    // TODO: all mentions of wallet in components should pull from that address
    const { address } = useAccount()

    const { address: kernelClientAddress, isKernelClientReady, handleLogin } = useZeroDev()

    // TODO: add handle
    const [user, setUser] = useState<interfaces.IUserProfile | null>(null)
    const [isAuthed, setIsAuthed] = useState<boolean>(false)
    const [isFetchingUser, setIsFetchingUser] = useState(true)
    const toast = useToast({
        position: 'bottom-right',
        duration: 5000,
        isClosable: true,
        icon: '🥜',
    })
    const toastIdRef = useRef<ToastId | undefined>(undefined)

    useEffect(() => {
        if (user != null) {
            afterLoginUserSetup()
        } else {
            setIsAuthed(false)
        }
    }, [user])

    // TODO: this needs to be moved elsewhere (i.e. possible walletContext), was
    // here for testing - POSSIBLY be removed bc the order is reversed:
    // you first login w/ passkeys, so flow below would never happen
    useEffect(() => {
        if (kernelClientAddress != null && isKernelClientReady) {
            authAndFetchUser(kernelClientAddress)
        }
    }, [kernelClientAddress, isKernelClientReady])

    const registerUserWithPasskey = async (username: string) => {
        //  validatiion of @handle has happened before this function
        const kernelClient = await handleLogin(username) //  TODO: replace this with handleRegister
        // TODO: case of failure on register
    }

    const loginUserWithPasskey = async (username: string) => {
        //  validatiion of @handle has happened before this function
        const kernelClient = await handleLogin(username)
        // TODO: case of failure on login
    }

    const authAndFetchUser = async (address: string) => {
        await authUser(address)
        await fetchUser()
    }

    const authUser = async (address: string) => {
        const userIdResponse = await fetch('/api/peanut/user/get-user-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accountIdentifier: address,
            }),
        })

        const response = await userIdResponse.json()

        const message = 'CHANGE THIS STRING WITH A MORE ROBUST THAT INCLUDES USER_ID'

        const signature = await signMessage(message)

        await fetch('/api/peanut/user/get-jwt-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signature: signature,
                message: message,
            }),
        })
    }

    // TODO: document better
    // used after register too (there is a login event then too)
    const afterLoginUserSetup = async (): Promise<undefined> => {
        // set isAuthed
        setIsAuthed(true)

        // // fetch user wallets
        // // set PW as active wallet
        setupWalletsAfterLogin()
    }


    const fetchUser = async (): Promise<interfaces.IUserProfile | null> => {
        // @Hugo0: this logic seems a bit duplicated. We should rework with passkeys login.
        try {
            const tokenAddressResponse = await fetch('/api/peanut/user/get-decoded-token')
            const { address: tokenAddress } = await tokenAddressResponse.json()
            if (address && tokenAddress && tokenAddress.toLowerCase() !== address.toLowerCase()) {
                setIsFetchingUser(false)
                setUser(null)
                return null
            }

            const userResponse = await fetch('/api/peanut/user/get-user-from-cookie')
            if (userResponse.ok) {
                const userData: interfaces.IUserProfile | null = await userResponse.json()
                setUser(userData)
                return userData
            } else {
                console.warn('Failed to fetch user. Probably not logged in.')
                return null
            }
        } catch (error) {
            console.error('ERROR WHEN FETCHING USER', error)
            return null
        } finally {
            setTimeout(() => {
                setIsFetchingUser(false)
            }, 500)
        }
    }

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
        if (!user) return

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

    const logoutUser = async () => {
        try {
            const response = await fetch('/api/peanut/user/logout-user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (response.ok) {
                setUser(null)
            } else {
                console.error('Failed to log out user')
            }
        } catch (error) {
            console.error('Error updating user', error)
        }
    }

    // TODO: this doesn't make sense
    // when we connect another wallet, we don't change the user at all
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUser()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [address])

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                isAuthed,
                updateBridgeCustomerId,
                fetchUser,
                updateUserName,
                submitProfilePhoto,
                loginUserWithPasskey,
                registerUserWithPasskey,
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
