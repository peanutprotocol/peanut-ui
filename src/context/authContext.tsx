'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AuthContextType {
    user: any // TODO: define type
    setUser: (user: any) => void
    fetchUser: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null)

    const fetchUser = async () => {
        const response = await fetch('/api/peanut/user/get-user-from-cookie')
        if (response.ok) {
            const userData: any = await response.json()
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
