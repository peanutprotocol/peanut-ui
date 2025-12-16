'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface ModalsContextType {
    // iOS PWA Install Modal
    isIosPwaInstallModalOpen: boolean
    setIsIosPwaInstallModalOpen: (isOpen: boolean) => void

    // Guest Login/Sign In Modal
    isSignInModalOpen: boolean
    setIsSignInModalOpen: (isOpen: boolean) => void

    // Support Drawer
    isSupportModalOpen: boolean
    setIsSupportModalOpen: (isOpen: boolean) => void
    supportPrefilledMessage: string
    setSupportPrefilledMessage: (message: string) => void
    openSupportWithMessage: (message: string) => void

    // QR Scanner
    isQRScannerOpen: boolean
    setIsQRScannerOpen: (isOpen: boolean) => void
}

const ModalsContext = createContext<ModalsContextType | undefined>(undefined)

export function ModalsProvider({ children }: { children: ReactNode }) {
    // iOS PWA Install Modal
    const [isIosPwaInstallModalOpen, setIsIosPwaInstallModalOpen] = useState(false)

    // Guest Login/Sign In Modal
    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)

    // Support Drawer
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
    const [supportPrefilledMessage, setSupportPrefilledMessage] = useState('')

    // QR Scanner
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)

    const openSupportWithMessage = useCallback((message: string) => {
        setSupportPrefilledMessage(message)
        setIsSupportModalOpen(true)
    }, [])

    const value = useMemo(
        () => ({
            // iOS PWA Install Modal
            isIosPwaInstallModalOpen,
            setIsIosPwaInstallModalOpen,

            // Guest Login/Sign In Modal
            isSignInModalOpen,
            setIsSignInModalOpen,

            // Support Drawer
            isSupportModalOpen,
            setIsSupportModalOpen,
            supportPrefilledMessage,
            setSupportPrefilledMessage,
            openSupportWithMessage,

            // QR Scanner
            isQRScannerOpen,
            setIsQRScannerOpen,
        }),
        [
            isIosPwaInstallModalOpen,
            isSignInModalOpen,
            isSupportModalOpen,
            supportPrefilledMessage,
            openSupportWithMessage,
            isQRScannerOpen,
        ]
    )

    return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>
}

export function useModalsContext() {
    const context = useContext(ModalsContext)
    if (context === undefined) {
        throw new Error('useModalsContext must be used within a ModalsProvider')
    }
    return context
}
