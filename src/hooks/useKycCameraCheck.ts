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

    const handleVerifyClick = async () => {
        // Pre-flight check: see if camera/mic are available
        const mediaCheck = await checkKycMediaReadiness()

        // If media is not supported or it's a restricted environment, show warning
        if (!mediaCheck.supported || mediaCheck.severity === 'warning') {
            setMediaCheckResult(mediaCheck)
            // Get the KYC URL first so we can offer "Open in Browser"
            const result = await onInitiateKyc()
            if (result?.success) {
                const url = result.url || result.data?.kycLink
                if (url) {
                    setKycUrlForBrowser(url)
                    setShowCameraWarning(true)
                    return { shouldProceed: false }
                }
            }
        }

        // Media check passed or couldn't get URL, proceed normally
        const result = await onInitiateKyc()
        return { shouldProceed: result?.success ?? false }
    }

    const handleContinueAnyway = () => {
        setShowCameraWarning(false)
        saveRedirect?.()
        onClose()
    }

    const handleOpenInBrowser = () => {
        if (kycUrlForBrowser) {
            window.open(kycUrlForBrowser, '_blank')
        }
        setShowCameraWarning(false)
        onClose()
    }

    return {
        showCameraWarning,
        mediaCheckResult,
        handleVerifyClick,
        handleContinueAnyway,
        handleOpenInBrowser,
    }
}
