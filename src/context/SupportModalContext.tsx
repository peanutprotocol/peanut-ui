'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface SupportModalContextType {
    isSupportModalOpen: boolean
    setIsSupportModalOpen: (isOpen: boolean) => void
    prefilledMessage: string
    setPrefilledMessage: (message: string) => void
    openSupportWithMessage: (message: string) => void
}

const SupportModalContext = createContext<SupportModalContextType | undefined>(undefined)

export function SupportModalProvider({ children }: { children: ReactNode }) {
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
    const [prefilledMessage, setPrefilledMessage] = useState('')

    const openSupportWithMessage = (message: string) => {
        setPrefilledMessage(message)
        setIsSupportModalOpen(true)
    }

    return (
        <SupportModalContext.Provider
            value={{
                isSupportModalOpen,
                setIsSupportModalOpen,
                prefilledMessage,
                setPrefilledMessage,
                openSupportWithMessage,
            }}
        >
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
