'use client'
import { usePasskeySupport, type PasskeySupportResult } from '@/hooks/usePasskeySupport'
import { createContext, useContext } from 'react'

const PasskeySupportContext = createContext<PasskeySupportResult | null>(null)

export const PasskeySupportProvider = ({ children }: { children: React.ReactNode }) => {
    const support = usePasskeySupport()
    return <PasskeySupportContext.Provider value={support}>{children}</PasskeySupportContext.Provider>
}

export const usePasskeySupportContext = () => {
    const context = useContext(PasskeySupportContext)
    if (!context) throw new Error('usePasskeySupportContext must be used within PasskeySupportProvider')
    return context
}
