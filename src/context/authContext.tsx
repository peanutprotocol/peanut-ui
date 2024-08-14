'use client'
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import * as interfaces from '@/interfaces'
import { useToast, ToastId } from '@chakra-ui/react'
import { useAccount } from 'wagmi'

interface AuthContextType {
    user: interfaces.IUserProfile | null
    setUser: (user: interfaces.IUserProfile | null) => void
    fetchUser: () => void
    updateUserName: (username: string) => Promise<void>
    submitProfilePhoto: (file: File) => Promise<void>
    isFetchingUser: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const { address } = useAccount()
    const [user, setUser] = useState<interfaces.IUserProfile | null>(null)
    const [isFetchingUser, setIsFetchingUser] = useState(false)
    const toast = useToast({
        position: 'bottom-right',
        duration: 5000,
        isClosable: true,
        icon: '🥜',
    })
    const toastIdRef = useRef<ToastId | undefined>(undefined)

    const fetchUser = async () => {
        try {
            const tokenAddressResponse = await fetch('/api/peanut/user/get-decoded-token')
            const { address: tokenAddress } = await tokenAddressResponse.json()
            if (address && tokenAddress.toLowerCase() !== address.toLowerCase()) {
                return setUser(null)
            }

            setIsFetchingUser(true)
            const response = await fetch('/api/peanut/user/get-user-from-cookie')
            if (response.ok) {
                const userData: interfaces.IUserProfile | null = await response.json()
                setUser(userData)
            }
        } catch (error) {
            console.error('Failed to fetch user', error)
        } finally {
            setIsFetchingUser(false)
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

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUser()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [address])

    return (
        <AuthContext.Provider value={{ user, setUser, fetchUser, updateUserName, submitProfilePhoto, isFetchingUser }}>
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
