import { useState } from 'react'
import { checkKycMediaReadiness, type MediaCheckResult } from '@/utils/mediaPermissions.utils'

interface UseKycCameraCheckOptions {
    onInitiateKyc: () => Promise<{ success: boolean; url?: string; data?: { kycLink?: string } } | undefined>
    onClose: () => void
    saveRedirect?: () => void
}

/**
 * Hook to handle camera/microphone pre-flight checks for KYC flows
 * Manages warning modal state and provides handlers for user actions
 */
export function useKycCameraCheck({ onInitiateKyc, onClose, saveRedirect }: UseKycCameraCheckOptions) {
    const [showCameraWarning, setShowCameraWarning] = useState(false)
    const [mediaCheckResult, setMediaCheckResult] = useState<MediaCheckResult | null>(null)
    const [kycUrlForBrowser, setKycUrlForBrowser] = useState<string | null>(null)
    const [isChecking, setIsChecking] = useState(false)

    const handleVerifyClick = async () => {
        // Prevent double-clicks
        if (isChecking) return { shouldProceed: false }
        setIsChecking(true)

        try {
            // Pre-flight check: see if camera/mic are available
            const mediaCheck = await checkKycMediaReadiness()

            // Always call KYC initiation once
            const result = await onInitiateKyc()

            // If media is not supported or it's a restricted environment, show warning
            if (result?.success && (!mediaCheck.supported || mediaCheck.severity === 'warning')) {
                setMediaCheckResult(mediaCheck)
                const url = result.url || result.data?.kycLink
                if (url) {
                    setKycUrlForBrowser(url)
                    setShowCameraWarning(true)
                    return { shouldProceed: false }
                }
            }

            return { shouldProceed: result?.success ?? false }
        } finally {
            setIsChecking(false)
        }
    }

    const handleContinueAnyway = () => {
        setShowCameraWarning(false)
        saveRedirect?.()
        onClose()
    }

    const handleOpenInBrowser = () => {
        if (kycUrlForBrowser) {
            // Validate URL is from expected domain for security
            try {
                const url = new URL(kycUrlForBrowser)
                if (url.protocol === 'https:') {
                    window.open(kycUrlForBrowser, '_blank')
                }
            } catch {
                console.error('Invalid KYC URL')
            }
        }
        setShowCameraWarning(false)
        onClose()
    }

    return {
        showCameraWarning,
        setShowCameraWarning,
        mediaCheckResult,
        handleVerifyClick,
        handleContinueAnyway,
        handleOpenInBrowser,
        isChecking,
    }
}
