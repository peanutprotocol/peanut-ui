'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

interface WalletContextType {
    user: interfaces.IUserProfile | null
    setUser: (user: interfaces.IUserProfile | null) => void
    fetchUser: () => Promise<interfaces.IUserProfile | null>
    addAccount: ({
        accountIdentifier,
        accountType,
        userId,
    }: {
        accountIdentifier: string
        accountType: string
        userId: string
    }) => Promise<void>
}
const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const { address } = useAccount()
    const BYOWWagmiAddress = address    // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useAccount() anywhere
    const [user, setUser] = useState<interfaces.IUserProfile | null>(null) // TODO: remove

    

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

    // this doesn't make sense
    // when we connect another wallet, we don't change the user at all
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUser()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [address])

    return (
        <WalletContext.Provider
            value={{
                user,
                setUser,
                fetchUser,
                addAccount,
            }}
        >
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = (): WalletContextType => {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
