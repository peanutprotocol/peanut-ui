'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface SupportModalContextType {
    isSupportModalOpen: boolean
    setIsSupportModalOpen: (isOpen: boolean) => void
}

const SupportModalContext = createContext<SupportModalContextType | undefined>(undefined)

export function SupportModalProvider({ children }: { children: ReactNode }) {
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)

    return (
        <SupportModalContext.Provider value={{ isSupportModalOpen, setIsSupportModalOpen }}>
            {children}
        </SupportModalContext.Provider>
    )
}

export function useSupportModalContext() {
    const context = useContext(SupportModalContext)
    if (context === undefined) {
        throw new Error('useSupportModal must be used within a SupportModalProvider')
    }
    return context
}
