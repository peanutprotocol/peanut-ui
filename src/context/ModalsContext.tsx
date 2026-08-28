'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { redactSupportText } from '@/utils/support-context'

interface ModalsContextType {
    // iOS PWA Install Modal
    isIosPwaInstallModalOpen: boolean
    setIsIosPwaInstallModalOpen: (isOpen: boolean) => void

    // Guest Login/Sign In Modal
    isSignInModalOpen: boolean
    setIsSignInModalOpen: (isOpen: boolean) => void

    // Get-the-app scan-to-download modal (pwa-sunset, desktop surfaces)
    isGetAppModalOpen: boolean
    setIsGetAppModalOpen: (isOpen: boolean) => void

    // Support Drawer
    isSupportModalOpen: boolean
    setIsSupportModalOpen: (isOpen: boolean) => void
    supportPrefilledMessage: string
    setSupportPrefilledMessage: (message: string) => void
    openSupportWithMessage: (message: string) => void

    // QR Scanner
    isQRScannerOpen: boolean
    setIsQRScannerOpen: (isOpen: boolean) => void

    // Security Verification Overlay — shown between the two passkey taps
    // of the mixed card-withdraw flow so the user has something to look at
    // while the kernel prepares the follow-up UserOp.
    isSecurityVerificationOpen: boolean
    setIsSecurityVerificationOpen: (isOpen: boolean) => void
}

const ModalsContext = createContext<ModalsContextType | undefined>(undefined)

export function ModalsProvider({ children }: { children: ReactNode }) {
    // iOS PWA Install Modal
    const [isIosPwaInstallModalOpen, setIsIosPwaInstallModalOpen] = useState(false)

    // Guest Login/Sign In Modal
    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)

    // Get-the-app scan-to-download modal
    const [isGetAppModalOpen, setIsGetAppModalOpen] = useState(false)

    // Support Drawer
    const [isSupportModalOpen, setIsSupportModalOpenState] = useState(false)
    const [supportPrefilledMessage, setSupportPrefilledMessage] = useState('')

    /*
     * A prefill belongs to the open cycle that set it. Nothing used to clear it,
     * so after one "contact support about X" entry point every later open — the
     * nav button included — reopened with X still in the composer, and the
     * support sidebar reported X as the topic.
     */
    const setIsSupportModalOpen = useCallback((open: boolean) => {
        setIsSupportModalOpenState(open)
        if (!open) setSupportPrefilledMessage('')
    }, [])

    // QR Scanner
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)

    // Security Verification Overlay
    const [isSecurityVerificationOpen, setIsSecurityVerificationOpen] = useState(false)

    /*
     * Redact before storing, so every downstream sink is covered at once — the
     * composer, and the `support_topic` row the app publishes to Crisp on open.
     * Call sites hand over `window.location.href` (ClaimErrorView,
     * Error.validation.view), and on a claim page the fragment is the bearer
     * password for the funds.
     */
    const openSupportWithMessage = useCallback((message: string) => {
        setSupportPrefilledMessage(redactSupportText(message))
        setIsSupportModalOpenState(true)
    }, [])

    const value = useMemo(
        () => ({
            // iOS PWA Install Modal
            isIosPwaInstallModalOpen,
            setIsIosPwaInstallModalOpen,

            // Guest Login/Sign In Modal
            isSignInModalOpen,
            setIsSignInModalOpen,

            // Get-the-app scan-to-download modal
            isGetAppModalOpen,
            setIsGetAppModalOpen,

            // Support Drawer
            isSupportModalOpen,
            setIsSupportModalOpen,
            supportPrefilledMessage,
            setSupportPrefilledMessage,
            openSupportWithMessage,

            // QR Scanner
            isQRScannerOpen,
            setIsQRScannerOpen,

            // Security Verification Overlay
            isSecurityVerificationOpen,
            setIsSecurityVerificationOpen,
        }),
        [
            isIosPwaInstallModalOpen,
            isSignInModalOpen,
            isGetAppModalOpen,
            isSupportModalOpen,
            setIsSupportModalOpen,
            supportPrefilledMessage,
            openSupportWithMessage,
            isQRScannerOpen,
            isSecurityVerificationOpen,
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

/**
 * Non-throwing variant — returns the context or `undefined` when the
 * provider isn't mounted (isolated test trees, Storybook, etc.). Use
 * when the consumer can sensibly no-op without modal access (e.g.
 * UI-polish overlays); prefer `useModalsContext` everywhere a missing
 * provider should be a hard error.
 */
export function useModalsContextOptional(): ModalsContextType | undefined {
    return useContext(ModalsContext)
}
