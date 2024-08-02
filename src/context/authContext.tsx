'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'

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
    const [user, setUser] = useState<interfaces.IUserProfile | null>(null)
    const [isFetchingUser, setIsFetchingUser] = useState(false)

    const fetchUser = async () => {
        try {
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
                console.error('Failed to submit profile photo')
            }
        } catch (error) {
            console.error('Error submitting profile photo', error)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [])

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
