'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
interface AuthContextType {
    user: interfaces.IUserProfile | null
    setUser: (user: interfaces.IUserProfile | null) => void
    fetchUser: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<interfaces.IUserProfile | null>(null)

    const fetchUser = async () => {
        const response = await fetch('/api/peanut/user/get-user-from-cookie')
        if (response.ok) {
            const userData: interfaces.IUserProfile | null = await response.json()
            setUser(userData)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [])

    return <AuthContext.Provider value={{ user, setUser, fetchUser }}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
