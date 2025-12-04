'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface ModalsContextType {
    isIosPwaInstallModalOpen: boolean
    setIsIosPwaInstallModalOpen: (isOpen: boolean) => void
}

const ModalsContext = createContext<ModalsContextType | undefined>(undefined)

export function ModalsProvider({ children }: { children: ReactNode }) {
    const [isIosPwaInstallModalOpen, setIsIosPwaInstallModalOpen] = useState(false)

    return (
        <ModalsContext.Provider
            value={{
                isIosPwaInstallModalOpen,
                setIsIosPwaInstallModalOpen,
            }}
        >
            {children}
        </ModalsContext.Provider>
    )
}

export function useModalsContext() {
    const context = useContext(ModalsContext)
    if (context === undefined) {
        throw new Error('useModalsContext must be used within a ModalsProvider')
    }
    return context
}
