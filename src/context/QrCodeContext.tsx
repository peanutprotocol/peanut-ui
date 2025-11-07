'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface QrCodeContextType {
    isQRScannerOpen: boolean
    setIsQRScannerOpen: (isOpen: boolean) => void
}

const QrCodeContext = createContext<QrCodeContextType | undefined>(undefined)

export function QrCodeProvider({ children }: { children: ReactNode }) {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    return <QrCodeContext.Provider value={{ isQRScannerOpen, setIsQRScannerOpen }}>{children}</QrCodeContext.Provider>
}

export function useQrCodeContext() {
    const context = useContext(QrCodeContext)
    if (context === undefined) {
        throw new Error('useQrCodeContext must be used within a QrCodeProvider')
    }
    return context
}
