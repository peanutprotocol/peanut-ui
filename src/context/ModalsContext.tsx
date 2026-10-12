'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { redactSupportText } from '@/utils/support-context'

interface ModalsContextType {
    // Guest Login/Sign In Modal
    isSignInModalOpen: boolean
    setIsSignInModalOpen: (isOpen: boolean) => void

    // Get-the-app scan-to-download modal for desktop surfaces
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
    securityVerificationVariant: SecurityVerificationVariant
    setIsSecurityVerificationOpen: (isOpen: boolean, variant?: SecurityVerificationVariant) => void

    // legal re-consent priority gate: ReConsentModal writes it, the download
    // prompt defers while it is not 'clear' FOR THE CURRENT ACCOUNT. the gate
    // carries the userId it was resolved for, so account A's 'clear' can
    // never release account B before B's own check publishes. 'checking'
    // also covers the status request in flight, so the prompt cannot flash
    // before legal resolves. starts 'checking' — the modal settles it on
    // every terminal path (incl. no user / failed check) and on unmount.
    legalConsentGate: LegalConsentGate
    setLegalConsentGate: (gate: LegalConsentGate) => void
}

/** status: 'checking' = request pending · 'prompting' = the legal modal is
 *  showing · 'clear' = resolved (accepted, snoozed, nothing to show, failed
 *  open, or no user). userId: the account the status belongs to; null means
 *  account-independent (logged out, or no consent surface mounted). */
export interface LegalConsentGate {
    status: 'checking' | 'prompting' | 'clear'
    userId: string | null
}

/** 'next-passkey' tells the user a second passkey sheet follows (mixed spend tap #2). */
export type SecurityVerificationVariant = 'default' | 'next-passkey'

const ModalsContext = createContext<ModalsContextType | undefined>(undefined)

export function ModalsProvider({ children }: { children: ReactNode }) {
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

    // legal re-consent gate — 'checking' until ReConsentModal reports, so a
    // first render can never race the download prompt past legal
    const [legalConsentGate, setLegalConsentGate] = useState<LegalConsentGate>({ status: 'checking', userId: null })

    // Security Verification Overlay
    const [securityVerification, setSecurityVerification] = useState<{
        open: boolean
        variant: SecurityVerificationVariant
    }>({ open: false, variant: 'default' })
    const isSecurityVerificationOpen = securityVerification.open
    const securityVerificationVariant = securityVerification.variant
    const setIsSecurityVerificationOpen = useCallback(
        (isOpen: boolean, variant: SecurityVerificationVariant = 'default') =>
            setSecurityVerification({ open: isOpen, variant }),
        []
    )

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
            securityVerificationVariant,
            setIsSecurityVerificationOpen,

            // Legal re-consent gate
            legalConsentGate,
            setLegalConsentGate,
        }),
        [
            isSignInModalOpen,
            isGetAppModalOpen,
            isSupportModalOpen,
            setIsSupportModalOpen,
            supportPrefilledMessage,
            openSupportWithMessage,
            isQRScannerOpen,
            isSecurityVerificationOpen,
            securityVerificationVariant,
            setIsSecurityVerificationOpen,
            legalConsentGate,
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
